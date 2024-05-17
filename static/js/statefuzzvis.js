"use strict";

// The minimum scale that we can set.
const minScale = 0.8;
var minHitCount = 1;
var maxHitCount = 2;

var stateSeqPtr = 0;

var stateSeqJson = undefined;
const stateToStateSeqStrings = {};

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
  canvas.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '-0 -5 10 10')
    .attr('refX', 0)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 4)
    .attr('markerHeight', 10)
    .attr('xoverflow', 'visible')
    .append('svg:path')
    .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
    .attr('fill', 'var(--gray)')
    .style('stroke', 'none');
  
  canvas.append('defs').append('marker')
    .attr('id', 'arrowhead-green')
    .attr('viewBox', '-0 -5 10 10')
    .attr('refX', 0)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 4)
    .attr('markerHeight', 10)
    .attr('xoverflow', 'visible')
    .append('svg:path')
    .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
    .attr('fill', 'var(--green)')
    .style('stroke', 'none');
  
  canvas.append('defs').append('marker')
    .attr('id', 'arrowhead-orange')
    .attr('viewBox', '-0 -5 10 10')
    .attr('refX', 0)
    .attr('refY', 0)
    .attr('orient', 'auto')
    .attr('markerWidth', 4)
    .attr('markerHeight', 10)
    .attr('xoverflow', 'visible')
    .append('svg:path')
    .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
    .attr('fill', 'var(--orange)')
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
        data.links.push({ "source": obj.name, "target": ref });
      });
    }
  });
  return data;
}

function parseJSONDataStateSeqSeed() {
  if (stateSeqJson === undefined) return;
  $.each(stateSeqJson, function (stateSeqString, _) {
    const stateSeqArr = stateSeqString.split("$$$");
    $.each(stateSeqArr, function(_, stateName) {
      if (stateToStateSeqStrings[stateName] === undefined)
        stateToStateSeqStrings[stateName] = []
      stateToStateSeqStrings[stateName].push(stateSeqString);
    });
  });
}

function dedupStateSeqMap(arr) {
  $.each(arr, function (_, obj) {
    stateToStateSeqStrings[obj.name] = 
      stateToStateSeqStrings[obj.name]
        .sort((a, b) => a.length - b.length)
        .reduce(function(a, b){ if (b != a[0]) a.unshift(b); return a }, [])
        .reverse();

  });
}

function drawEdges(g, d) {
  return g.append("g")
    .attr('stroke', '#666666')
    .attr("stroke-opacity", 0.6)
    .selectAll("path")
    .data(d.links)
    .attr("source", d => d.source.id)
    .attr("target", d => d.target.id)
    .join("path")
    .attr("class", "link")
}

function appendStateInfo(list, node) {
  list.append("li")
    .classed("list-group-item", true)
    .text("Hit count: " + node.hitCount);
}

function constructIcon(faName, title) {
  return "<i class=\"fa " + faName + "\" title = \"" + title + "\"></i> ";
}

function nextPage(item, list, node) {
  stateSeqPtr = Math.min(stateSeqPtr+10, stateToStateSeqStrings[node.name].length);
  item.remove();
  appendStateSeqSeedInfo(list, node);
}

function prevPage(item, list, node) {
  stateSeqPtr = Math.max(stateSeqPtr-10, 0);
  item.remove();
  appendStateSeqSeedInfo(list, node);
}

function appendStateSeqSeedInfo(list, node) {
  const item = list.append("li")
    .classed("list-group-item", true);
  const end = Math.min(stateSeqPtr+10, stateToStateSeqStrings[node.name].length);
  
  
  const buttonDiv = item.append("div")
  buttonDiv
    .append("button")
    .classed("btn btn-light btn-sm", true)
    .html(constructIcon("fa-arrow-left", "Prev"))
    .on("click", () => prevPage(item, list, node));
  buttonDiv
    .append("button")
    .classed("btn btn-light btn-sm", true)
    .html(constructIcon("fa-arrow-right", "Next"))
    .on("click", () => nextPage(item, list, node));
  
  item.append("div").text(`State sequences (${stateSeqPtr}-${end}/${stateToStateSeqStrings[node.name].length}): `);
  
  const stateSeqStrs = stateToStateSeqStrings[node.name].slice(stateSeqPtr, end);
  const stateSeqList = item.append("ul");
  $.each(stateSeqStrs, function (_, stateSeqStr) {
    const stateSeqArr = 
      stateSeqStr
        .split("$$$")
        .map(function (stateName) {
          if (stateName === node.name) {
            return `<b><u>${stateName}</u></b>`;
          }
          return stateName;
        });
    stateSeqList
      .append("li")
      .append("a")
      .attr("href", '/stateSeq/' + stateSeqStr)
      .html(stateSeqArr.join(" → "));
  });
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

function setNumExecs(numExecs) {
  d3.select("#info-exec-count")
    .text(`#Execs: ${numExecs}`);
}

function setNumStates(numStates) {
  d3.select("#info-states-count")
    .text(`#States: ${numStates}`);
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
  if (currentSelection !== node.name) {
    let list = clearContents().append("ul").classed("list-group", true);
    appendStateInfo(list, node);
    stateSeqPtr = 0;
    appendStateSeqSeedInfo(list, node);
    setTitle(node);
    currentSelection = node.name;
    showInfobox();
  } else {
    currentSelection = undefined;
    hideInfobox();
  }
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
  const maxX = 100000;
  const maxY = 200;
  const marginY = height / 2 / minScale;
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

function clearSearchResults(nodes, links) {
  nodes.select(".node").classed("node-found", function (node) {
    return (currentSelection === node.name);
  });
  links.attr("class", function (link) {
    if (currentSelection === undefined) {
      return "link";
    }

    if (currentSelection === link.source.name) {
      return "link-found-out"; 
    } else if (currentSelection === link.target.name) {
      return "link-found-in"; 
    }
    return "link-less-visible";
  });
}

function showState(node, nodes, links, zoom, canvas, width, height) {
  const k = 2.0;
  const x = - node.x * k + width / 2;
  const y = - node.y * k + height / 2;
  onClick(node);
  clearSearchResults(nodes, links);
  canvas.transition().duration(750)
    .call(zoom.transform,
          d3.zoomIdentity.translate(x, y).scale(k));
}

function installClickHandler(nodes, links) {
  $(document).on("click", "svg", function (evt) {
    clearSearchResults(nodes, links);
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
        x2 = x2 - ((25 + 7) * dx / dr); 
        y2 = y2 - ((25 + 7) * dy / dr);
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
               return 0.05;
             }))
    .force("charge", d3.forceManyBody().strength(-2000).distanceMax(10000))
    .force(
      "manyBody",
      d3.forceManyBody().distanceMin(100).distanceMax(10000)
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
      
      d3.json("data/state_seq_seed.json")
      .then(function (_stateSeqJson) {
        stateSeqJson = _stateSeqJson;
        parseJSONDataStateSeqSeed();
        dedupStateSeqMap(json);
        const width = $("#js-canvas").width();
        const height = $("#js-canvas").height();
        deleteCanvas();
        const canvas = createCanvas(width, height);
        createDirectedEdges(canvas);
        const simulation = d3.forceSimulation();
        const g = canvas.append("g");
        const d = parseJSONData(json);
        setNumStates(json.length);
        const links = drawEdges(g, d);
        const nodes = drawNodes(g, d, simulation);
        const zoom = installZoomHandler(height, canvas, g, d);
        installClickHandler(nodes, links);
        installDragHandler();
        installInfoBoxCloseHandler();
        initSimulation(d, simulation, width, height, links, nodes);
        zoom.scaleTo(canvas, minScale);
        console.log("loading done!");
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
              showState(data, nodes, links, zoom, canvas, width, height);
            }, 1000);
          }
        }, 500);
      });
    });
}

function loadExecs() {
  d3.text("data/execs_count.txt")
    .then(function(txt) {
      setNumExecs(txt);
    })
}

loadJson();
loadExecs();
