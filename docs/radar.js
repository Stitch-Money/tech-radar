// The MIT License (MIT)

// Copyright (c) 2017 Zalando SE

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.


function radar_visualization(config) {

  // custom random number generator, to make random sequence reproducible
  // source: https://stackoverflow.com/questions/521295
  var seed = 42;
  function random() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  function random_between(min, max) {
    return min + random() * (max - min);
  }

  function normal_between(min, max) {
    return min + (random() + random()) * 0.5 * (max - min);
  }

  // radial_min / radial_max are multiples of PI
  const quadrants = [
    { radial_min: 0, radial_max: 0.5, factor_x: 1, factor_y: 1 },
    { radial_min: 0.5, radial_max: 1, factor_x: -1, factor_y: 1 },
    { radial_min: -1, radial_max: -0.5, factor_x: -1, factor_y: -1 },
    { radial_min: -0.5, radial_max: 0, factor_x: 1, factor_y: -1 }
  ];

  const rings = [
    { radius: 130 },
    { radius: 220 },
    { radius: 310 },
    { radius: 400 }
  ];

  const footer_offset =
    { x: -660, y: 420 };

  const legend_offset = [
    { x: 455, y: 55 },
    { x: -660, y: 55 },
    { x: -660, y: -345 },
    { x: 450, y: -340 }
  ];

  function polar(cartesian) {
    var x = cartesian.x;
    var y = cartesian.y;
    return {
      t: Math.atan2(y, x),
      r: Math.sqrt(x * x + y * y)
    }
  }

  function cartesian(polar) {
    return {
      x: polar.r * Math.cos(polar.t),
      y: polar.r * Math.sin(polar.t)
    }
  }

  function bounded_interval(value, min, max) {
    var low = Math.min(min, max);
    var high = Math.max(min, max);
    return Math.min(Math.max(value, low), high);
  }

  function bounded_ring(polar, r_min, r_max) {
    return {
      t: polar.t,
      r: bounded_interval(polar.r, r_min, r_max)
    }
  }

  function bounded_box(point, min, max) {
    return {
      x: bounded_interval(point.x, min.x, max.x),
      y: bounded_interval(point.y, min.y, max.y)
    }
  }

  function segment(quadrant, ring) {
    var polar_min = {
      t: quadrants[quadrant].radial_min * Math.PI,
      r: ring === 0 ? 30 : rings[ring - 1].radius
    };
    var polar_max = {
      t: quadrants[quadrant].radial_max * Math.PI,
      r: rings[ring].radius
    };
    var cartesian_min = {
      x: 15 * quadrants[quadrant].factor_x,
      y: 15 * quadrants[quadrant].factor_y
    };
    var cartesian_max = {
      x: rings[3].radius * quadrants[quadrant].factor_x,
      y: rings[3].radius * quadrants[quadrant].factor_y
    };
    return {
      clipx: function(d) {
        var c = bounded_box(d, cartesian_min, cartesian_max);
        var p = bounded_ring(polar(c), polar_min.r + 15, polar_max.r - 15);
        d.x = cartesian(p).x; // adjust data too!
        return d.x;
      },
      clipy: function(d) {
        var c = bounded_box(d, cartesian_min, cartesian_max);
        var p = bounded_ring(polar(c), polar_min.r + 15, polar_max.r - 15);
        d.y = cartesian(p).y; // adjust data too!
        return d.y;
      },
      random: function() {
        return cartesian({
          t: random_between(polar_min.t, polar_max.t),
          r: normal_between(polar_min.r, polar_max.r)
        });
      }
    }
  }

  // position each entry randomly in its segment
  for (var i = 0; i < config.entries.length; i++) {
    var entry = config.entries[i];
    entry.segment = segment(entry.quadrant, entry.ring);
    var point = entry.segment.random();
    entry.x = point.x;
    entry.y = point.y;
    entry.color = entry.active || config.print_layout ?
      config.rings[entry.ring].color : config.colors.inactive;
  }

  // partition entries according to segments
  var segmented = new Array(4);
  for (var quadrant = 0; quadrant < 4; quadrant++) {
    segmented[quadrant] = new Array(4);
    for (var ring = 0; ring < 4; ring++) {
      segmented[quadrant][ring] = [];
    }
  }
  for (var i=0; i<config.entries.length; i++) {
    var entry = config.entries[i];
    segmented[entry.quadrant][entry.ring].push(entry);
  }

  // assign unique sequential id to each entry
  var id = 1;
  for (var quadrant of [2,3,1,0]) {
    for (var ring = 0; ring < 4; ring++) {
      var entries = segmented[quadrant][ring];
      entries.sort(function(a,b) { return a.label.localeCompare(b.label); })
      for (var i=0; i<entries.length; i++) {
        entries[i].id = "" + id++;
      }
    }
  }

  function translate(x, y) {
    return "translate(" + x + "," + y + ")";
  }

  function viewbox(quadrant) {
    return [
      Math.max(0, quadrants[quadrant].factor_x * 400) - 420,
      Math.max(0, quadrants[quadrant].factor_y * 400) - 420,
      440,
      440
    ].join(" ");
  }

  var svg = d3.select("svg#" + config.svg_id)
    .style("background-color", config.colors.background)
    .attr("width", config.width)
    .attr("height", config.height);

  var radar = svg.append("g");
  if ("zoomed_quadrant" in config) {
    svg.attr("viewBox", viewbox(config.zoomed_quadrant));
  } else {
    radar.attr("transform", translate(config.width / 2, config.height / 2));
  }

  var grid = radar.append("g");

  // draw grid lines
  grid.append("line")
    .attr("x1", 0).attr("y1", -400)
    .attr("x2", 0).attr("y2", 400)
    .style("stroke", config.colors.grid)
    .style("stroke-width", 1);
  grid.append("line")
    .attr("x1", -400).attr("y1", 0)
    .attr("x2", 400).attr("y2", 0)
    .style("stroke", config.colors.grid)
    .style("stroke-width", 1);

  // background color. Usage `.attr("filter", "url(#solid)")`
  // SOURCE: https://stackoverflow.com/a/31013492/2609980
  var defs = grid.append("defs");
  var filter = defs.append("filter")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", 1)
    .attr("height", 1)
    .attr("id", "solid");
  filter.append("feFlood")
    .attr("flood-color", "rgb(0, 0, 0, 0.8)");
  filter.append("feComposite")
    .attr("in", "SourceGraphic");

  // draw rings
  for (var i = 0; i < rings.length; i++) {
    grid.append("circle")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("r", rings[i].radius)
      .style("fill", "none")
      .style("stroke", config.colors.circle)
      .style("stroke-width", 1);
    if (!(i === 0)) {
      grid.append("text")
        .text(config.rings[i].name)
        .attr("y", -rings[i].radius + 53)
        .attr("text-anchor", "middle")
        .style("fill", "#D1CFD6")
        .style("font-family", "Rational Text Medium")
        .style("font-size", "27px")
        .style("pointer-events", "none")
        .style("user-select", "none");
      grid.append("text")
        .text(config.rings[i].name)
        .attr("y", rings[i].radius - 35)
        .attr("text-anchor", "middle")
        .style("fill", "#D1CFD6")
        .style("font-family", "Rational Text Medium")
        .style("font-size", "27px")
        .style("pointer-events", "none")
        .style("user-select", "none");
    }
  }

  grid.append("text")
  .text(config.rings[0].name)
  .attr("x", 0)
  .attr("y", 8)
  .attr("text-anchor", "middle")
  .style("fill", "#D1CFD6")
  .style("font-family", "Rational Text Medium")
  .style("font-size", "27px")
  .style("pointer-events", "none")
  .style("user-select", "none");

  function legend_transform(quadrant, ring, index=null, x_offset=0, y_offset=0) {
    var dx = ring < 2 ? 0 : 120;
    var dy = (index == null ? -16 : index * 12);
    if (ring % 2 === 1) {
      dy = dy + 85 + segmented[quadrant][ring-1].length * 12;
    }
    return translate(
      legend_offset[quadrant].x + dx + x_offset,
      legend_offset[quadrant].y + dy + y_offset
    );
  }
  // draw title and legend (only in print layout)
  if (config.print_layout) {

    // footer
    radar.append("text")
      .attr("transform", translate(footer_offset.x, footer_offset.y))
      .text("▲ moved up     ▼ moved down")
      .attr("xml:space", "preserve")
      .style("font-family", "Rational Text Medium")
      .style("font-size", "10px");

    // legend
    var legend = radar.append("g");
    for (var quadrant = 0; quadrant < 4; quadrant++) {
      legend.append("text")
        .attr("transform", translate(
          legend_offset[quadrant].x,
          legend_offset[quadrant].y - 45
        ))
        .text(config.quadrants[quadrant].name)
        .style("font-family", "Rational Text Medium")
        .style("font-size", "19px");
      for (var ring = 0; ring < 4; ring++) {
        legend.append("text")
          .attr("transform", legend_transform(quadrant, ring, ))
          .text(config.rings[ring].name)
          .style("font-family", "Rational Text Medium")
          .style("font-size", "12px")
        legend.append("foreignObject")
            .attr("width", 110)
            .attr("height", segmented[quadrant][ring].length * 20)
            .attr("transform", function(d, i) { return legend_transform(quadrant, ring, 0, 3); })
            .attr("class", "legend" + quadrant + ring)
            .append("xhtml:div")
            .html(formatLegend(segmented[quadrant][ring]))
            .style("font-family", "Rational Text Book")
            .style("font-size", "12px")
        for(legendItem of segmented[quadrant][ring]){
          console.log(legendItem.id);
          document.getElementById("legendItem" + legendItem.id)
          .onmouseover = (function(d) { return function() {showBubble(d); highlightLegendItem(d)}})(legendItem)
          document.getElementById("legendItem" + legendItem.id)
          .onmouseout = (function(d) { return function() { hideBubble(d); unhighlightLegendItem(d)}})(legendItem)
        }

    
          // .data(segmented[quadrant][ring])
          // .enter()
          //   .append("a")
          //       .attr("href", function (d, i) {
          //         return d.link ? d.link : "#"; // stay on same page if no link was provided
          //       })
          //   .append("foreignObject")
          //     .attr("width", 200)
          //     .attr("height", 20)
          //     .attr("transform", function(d, i) { return legend_transform(quadrant, ring, i); })
          //     .attr("class", "legend" + quadrant + ring)
          //     .attr("id", function(d, i) { return "legendItem" + d.id; })
          //     .on("mouseover", function(d) { showBubble(d); highlightLegendItem(d); })
          //     .on("mouseout", function(d) { hideBubble(d); unhighlightLegendItem(d); })
          //     .append("xhtml:div")
          //     .html(function(d,i) { return formatLegend(d,i)})
          //     .style("font-family", "Rational Text Book")
          //     .style("font-size", "12px")
      }
    }
  }

  // layer for entries
  var rink = radar.append("g")
    .attr("id", "rink");

  // rollover bubble (on top of everything else)
  var bubble = radar.append("g")
    .attr("id", "bubble")
    .attr("x", 0)
    .attr("y", 0)
    .style("opacity", 0)
    .style("pointer-events", "none")
    .style("user-select", "none")
  bubble.append("rect")
    .attr("rx", 4)
    .attr("dy", 4)
    .style("fill", "#17121F");
  bubble.append("text")
    .style("font-family", "Rational Text Book")
    .style("font-size", "10px")
    .style("fill", "#FFFFFF")
    .text("test");
  bubble.append("path")
    .attr("d", "M 0,0 10,0 5,8 z")
    .style("fill", "#17121F");

  function showBubble(d) {
    if (d.active || config.print_layout) {
      // The actual text
      var tooltip = d3.select("#bubble text")
        .attr("dy", -1)
        .call(wrapBubbleText, [200, d.label, d.description])
      var bbox = tooltip.node().getBBox();
      // The whole bubble
      d3.select("#bubble")
        .attr("transform", translate(d.x - bbox.width / 2 - 15, d.y - bbox.height  - 30))
        .style("opacity", 1)
        .attr("dy", 1)
      // The black rectangle background
      d3.select("#bubble rect")
        .attr("x", 0 )
        .attr("y", -10)
        .attr("width", bbox.width + 30)
        .attr("height", bbox.height + 20)
      // The down arrow
      d3.select("#bubble path")
        .attr("transform", translate(bbox.width / 2 + 10, bbox.height + 9));
    }
  }

  function numLines(label, charLimit){
    return Math.ceil(label.length / charLimit)
  }

  // function formatLegend(data, index){
  //   var label = data.label
  //   var id = data.id < 10 ? "0"+ data.id : data.id
  //   var labelWords = label.split()
  //   var charLength = 20
  //   var div = "<div>"
  //   var line = [id + ". "]
  //   while (word = labelWords.pop()) {
  //     line.push(word);
  //     if (line.join(" ").length > charLength) {
  //       console.log("Here")
  //       // Add word(s) to sentence
  //       div = div + line.join(" ")
  //       // clear the line
  //       line = []
  //     }
  //   }
  //   return div + line.join(" ") + "</div>"
  // }

  function formatLegend(data){
  //  console.log(data)
   div = "<div>"
   for(item of data){
      // console.log(item)
       div = div + `<label id="legendItem${item.id}"> ${(item.id < 10 ? "0"+ item.id : item.id )}. ${item.label} </label><br>`
   }
   return div + "</div>"
  }

  function wrapBubbleText(text, data) {
    text.each(function() {
      var text = d3.select(this),
          description = data[2],
          words = description.split(/\s+/).reverse(),
          title = data[1],
          word,
          line = [],
          lineHeight = 1.1, // ems
          y = text.attr("y"),
          dy = parseFloat(text.attr("dy"))
          titleSpacing = 0.5

      text.node().innerHTML = ''
      // Add the title
      tspan = text.append("tspan").attr("x", 15).attr("y", y + 20).attr("dy", dy + "em").text(title).attr("font-family", "Rational Text Medium");
      dy = dy + lineHeight + titleSpacing
      tspan = text.append("tspan").attr("x", 15).attr("y", y + 20).attr("dy", dy + "em");
      while (word = words.pop()) {
        line.push(word);
        tspan.text(line.join(" "));
        if (tspan.node().getComputedTextLength() > data[0]) {
          dy = dy + lineHeight
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          tspan = text.append("tspan").attr("x", 15).attr("y", y + 20).attr("dy", dy + "em").text(word);
        }
      }
    });
  }

  function hideBubble(d) {
    var bubble = d3.select("#bubble")
      .attr("transform", translate(0,0))
      .style("opacity", 0);
  }

  function highlightLegendItem(d) {
    var legendItem = document.getElementById("legendItem" + d.id);
    legendItem.setAttribute("style", "color:#911FFF");
  }

  function unhighlightLegendItem(d) {
    var legendItem = document.getElementById("legendItem" + d.id);
    legendItem.setAttribute("style", "color:#17121F");
  }

  // draw blips on radar
  var blips = rink.selectAll(".blip")
    .data(config.entries)
    .enter()
      .append("g")
        .attr("class", "blip")
        .attr("transform", function(d, i) { return legend_transform(d.quadrant, d.ring, i); })
        .on("mouseover", function(d) { showBubble(d); highlightLegendItem(d); })
        .on("mouseout", function(d) { hideBubble(d); unhighlightLegendItem(d); });

  // configure each blip
  blips.each(function(d) {
    var blip = d3.select(this);

    // blip link
    if (!config.print_layout && d.active && d.hasOwnProperty("link")) {
      blip = blip.append("a")
        .attr("xlink:href", d.link);
    }

    // blip shape
    if (d.moved > 0) {
      blip.append("path")
        .attr("d",  "m -2.3807652,-11.744401 c 1.1378619,-1.931959 4.0503168,-1.93196 5.1881787,0 L 11.111864,2.3555527 C 12.227941,4.2503864 10.794168,6.5917241 8.5178039,6.5917241 H -8.0911455 c -2.2763845,0 -3.7101335,-2.3413377 -2.5941085,-4.2361714 z") // triangle pointing up
        .style("fill", d.color);
    } else if (d.moved < 0) {
      blip.append("path")
        .attr("d", "m 2.524639,10.273073 c -0.921977,1.603014 -3.28185752,1.603014 -4.2038819,0 L -8.4080917,-1.4262573 c -0.9042866,-1.5722569 0.2574402,-3.5149428 2.1019363,-3.5149428 l 13.4577644,1.3e-6 c 1.844472,0 3.006218,1.9426846 2.101893,3.514937 z") // triangle pointing down
        .style("fill", d.color)

    } else {
      blip.append("circle")
        .attr("r", 9)
        .attr("fill", d.color);
    }

    // blip text
    if (d.active || config.print_layout) {
      var blip_text = d.id < 10 ? "0" + d.id : d.id;
      var fill = d.ring === 3 ? "#911FFF" : "#fff";
      blip.append("text")
        .text(blip_text)
        .attr("y", 3)
        .attr("text-anchor", "middle")
        .style("fill", fill)
        .style("font-family", "Rational Text Medium")
        .style("font-size", function(d) { return blip_text.length > 2 ? "8px" : "9px"; })
        .style("pointer-events", "none")
        .style("user-select", "none");
    }
  });

  // make sure that blips stay inside their segment
  function ticked() {
    blips.attr("transform", function(d) {
      return translate(d.segment.clipx(d), d.segment.clipy(d));
    })
  }

  // distribute blips, while avoiding collisions
  d3.forceSimulation()
    .nodes(config.entries)
    .velocityDecay(0.19) // magic number (found by experimentation)
    .force("collision", d3.forceCollide().radius(12).strength(0.85))
    .on("tick", ticked);
}
