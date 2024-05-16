"use strict";

// The minimum scale that we can set.
const minScale = 0.8;
var minHitCount = 1;
var maxHitCount = 2;

// The currently selected node's name.
var currentSelection = undefined;

function createCanvas(width, height) {
  return d3.select("#js-canvas")
    .append("svg")
      .attr("width", "100%")
      .attr("height", "100%");
}

function deleteCanvas(width, height) {
  d3.select('#js-canvas').selectAll('*').remove();
}

function createDirectedEdges(canvas) {
  return canvas.append('defs').append('marker')
  .attr('id', 'arrowhead')
  .attr('viewBox', '-0 -5 10 10')
  .attr('refX', 0)
  .attr('refY', 0)
  .attr('orient', 'auto')
  .attr('markerWidth', 8)
  .attr('markerHeight', 10)
  .attr('xoverflow', 'visible')
  .append('svg:path')
  .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
  .attr('fill', '#999')
  .style('stroke', 'none');
}

function parseJSONData(arr) {
  let dict = {};
  var data = {
    "nodes": [],
    "links": []
  };
  $.each(arr, function (_, obj) {
    dict[obj.name] = obj;
    data.nodes.push(obj);
    minHitCount = Math.min(minHitCount, obj.hitCount);
    maxHitCount = Math.max(maxHitCount, obj.hitCount);
  });
  $.each(arr, function (_, obj) {
    if (obj.nextStates !== undefined) {
      $.each(obj.nextStates, function (_, ref) {
        console.log(obj.name + " -> " + ref);
        data.links.push({ "source": obj.name, "target": ref });
      });
    }
  });
  return data;
}

function drawEdges(g, d) {
  return g.append("g")
    .attr('stroke', '#666666')
    .attr("stroke-opacity", 0.6)
    .selectAll("path")
    .data(d.links)
    .attr("source",d=> d.source.id)
    .attr("target",d=> d.target.id)
    .join("path")
    .attr("stroke-width", 2)
    .attr('marker-end', 'url(#arrowhead)')
    .attr("fill", "none");
}

function appendStateInfo(list, node) {
  list.append("li")
    .classed("list-group-item", true)
    .text("Hit Count: " + node.hitCount);
}

function setTitle(node) {
  const header = d3.select("#js-infobox-header");
  if (node === undefined) {
    d3.select("#js-infobox-title").text("Select a state");
  } else {
    d3.select("#js-infobox-title")
      .text("[ Hello this is title for stats ] " + node.name);
  }
}

function clearContents() {
  return d3.select("#js-infobox-content").html("");
}

function showInfobox() {
  d3.select("#js-infobox").style("display", "block");
}

function hideInfobox() {
  d3.select("#js-infobox").style("display", "none");
}

function onClick(node) {
  let list = clearContents().append("ul").classed("list-group", true);
  appendStateInfo(list, node);
  setTitle(node);
  currentSelection = node.name;
  showInfobox();
}

function drawNodes(g, d, simulation) {
  const nodes = g.append("g")
    .selectAll("rect")
    .data(d.nodes)
    .enter()
    .append("g");

  function dragStart(d) {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart()
    d.fx = d.x;
    d.fy = d.y;
    d.isDragging = true;
  }

  function dragMiddle(d) {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }

  function dragEnd(d) {
    if (!d3.event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
    d.isDragging = false;
  }

  nodes.append("ellipse")
    .attr("rx", 25)
    .attr("ry", 25)
    .attr("class", "node")
    .style("fill", function (d) {
      const normalizedVal = 150 - Math.trunc(150 * ((d.hitCount - minHitCount) / (maxHitCount - minHitCount)));
      return `rgb(${normalizedVal},${normalizedVal},${normalizedVal+100})`;
    })
    .on("click", onClick)
    .call(d3.drag()
            .on("start", dragStart)
            .on("drag", dragMiddle)
            .on("end", dragEnd));

  nodes.append("text")
    .attr("class", "nodetext")
    .style("fill", function (d) {
      const normalizedVal = ((d.hitCount - minHitCount) / (maxHitCount - minHitCount));
      if (normalizedVal > 0.5) {
        return "rgb(255,255,255)";
      }
      return "rgb(0,0,0)";
    })
    .attr("dominant-baseline", "middle")
    .text(function (d) { return d.name })
    .on("click", onClick);

  const dragHandler = d3.drag()
    .on("start", dragStart)
    .on("drag", dragMiddle)
    .on("end", dragEnd);
  dragHandler(nodes);

  return nodes;
}

function installZoomHandler(height, canvas, g, d) {
  const maxX = 100;
  const maxY = 100;
  const marginY = 100 / 2 / minScale;
  const zoomHandler =
    d3.zoom()
      .scaleExtent([minScale, 5])
      .translateExtent([[-maxX, 100 - marginY], [maxX, maxY + marginY]])
      .on("zoom", function () {
        g.attr("transform", d3.event.transform)
      });
  zoomHandler(canvas);
  return zoomHandler;
}

function clearSearchResults(nodes, resultList) {
  nodes.select(".node").classed("node-found", function (node) {
    return (currentSelection === node.name);
  });
  resultList.html("");
}

function showState(node, nodes, zoom, canvas, width, height) {
  const resultList = d3.select("#js-searchform-result");
  const k = 2.0;
  const x = - node.x * k + width / 2;
  const y = - node.y * k + height / 2;
  onClick(node);
  clearSearchResults(nodes, resultList);
  canvas.transition().duration(750)
    .call(zoom.transform,
          d3.zoomIdentity.translate(x, y).scale(k));
}

function installClickHandler(nodes) {
  const resultList = d3.select("#js-searchform-result");
  $(document).on("click", "svg", function (evt) {
    clearSearchResults(nodes, resultList);
  });
}

function installDragHandler() {
  const infobox = d3.select("#js-infobox");
  $("#js-infobox").resizable({
    handles: { w: $("#js-separator") },
    resize: function (_e, ui) {
      const orig = ui.originalSize.width;
      const now = ui.size.width;
      const width = orig + orig - now;
      infobox.style("flex-basis", width + "px");
      infobox.style("width", null);
      infobox.style("height", null);
    }
  });
}

function installInfoBoxCloseHandler() {
  $("#js-infobox-close").click(function () { hideInfobox(); });
}

function ticked(links, nodes, simulation) {
  return function (e) {
    nodes.attr("transform", function (d) {
      return "translate(" + d.x + "," + d.y + ")";
    });
    

    links.attr("d", function(d) {
      var x1 = d.source.x;
      var y1 = d.source.y;
      var x2 = d.target.x;
      var y2 = d.target.y;
      var dx = x2 - x1;
      var dy = y2 - y1;
      var dr = Math.sqrt(dx * dx + dy * dy);

      // Defaults for normal edge.
      var drx = dr;
      var dry = dr;
      var xRotation = 0; // degrees
      var largeArc = 0; // 1 or 0
      var sweep = 1; // 1 or 0

      // Self edge.
      if (x1 === x2 && y1 === y2) {
        // Fiddle with this angle to get loop oriented.
        xRotation = -45;

        // Needs to be 1.
        largeArc = 1;

        // Change sweep to change orientation of loop. 
        //sweep = 0;

        // Make drx and dry different to get an ellipse
        // instead of a circle.
        drx = 30;
        dry = 30;
        
        // For whatever reason the arc collapses to a point if the beginning
        // and ending points of the arc are the same, so kludge it.
        x2 = x2 + 1;
        y2 = y2 + 1;
      } else {
        // Cut x1 x2 to show arrowhead
        x2 = x2 - ((25 + 15) * dx / dr); 
        y2 = y2 - ((25 + 15) * dy / dr);
      }

      return "M" + x1 + "," + y1 + "A" + drx + "," + dry + " " + xRotation + "," + largeArc + "," + sweep + " " + x2 + "," + y2;
    });
  }
}

function initSimulation(d, simulation, width, height, links, nodes) {
  simulation
    .nodes(d.nodes)
    .force("link",
           d3.forceLink()
             .id(function (d) { return d.name; })
             .strength(function (link) {
               return 0.2;
             }))
    .force("charge", d3.forceManyBody().strength(-2000).distanceMax(500))
    .force(
      "manyBody",
      d3.forceManyBody().distanceMin(100).distanceMax(200)
    )
    .on("tick", ticked(links, nodes, simulation));

  simulation.force("link").links(d.links);
}

function getQueryVariable(variable) {
  var query = window.location.search.substring(1);
  var vars = query.split('&');
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=');
    if (decodeURIComponent(pair[0]) == variable) {
      return decodeURIComponent(pair[1]);
    }
  }
  return undefined;
}

function loadJson() {
  d3.json("data/states.json")
    .then(function (json) {
      const width = $("#js-canvas").width();
      const height = $("#js-canvas").height();
      deleteCanvas();
      const canvas = createCanvas(width, height);
      createDirectedEdges(canvas);
      const simulation = d3.forceSimulation();
      const g = canvas.append("g");
      const d = parseJSONData(json);
      const links = drawEdges(g, d);
      const nodes = drawNodes(g, d, simulation);
      const zoom = installZoomHandler(height, canvas, g, d);
      installClickHandler(nodes);
      installDragHandler();
      installInfoBoxCloseHandler();
      initSimulation(d, simulation, width, height, links, nodes);
      zoom.scaleTo(canvas, minScale);
      // Center the graph after a sec.
      setTimeout(function () {
        const key = getQueryVariable("k");
        const data = d.nodes.find(function (d) { return (d.name === key); });
        if (key === undefined || data === undefined) {
          const graphScale = d3.zoomTransform(g.node()).k;
          const y = height / 2 / graphScale;
          zoom.translateTo(canvas, 0, y);
        } else {
          setTimeout(function () {
            showState(data, nodes, zoom, canvas, width, height);
          }, 1000);
        }
      }, 500);
    });
}

loadJson();