
var started = false;
var num_nodes;
var events = Array();

var lastCall = null;

var replayTime = 0.0;
var replaySpeed = 0.0;
var lastEvIdx = -1;
var lastDirectionForward = true;
var isPaused = true;

function onStartPauseResume(e) {
    
    if (!started) {
        replaySpeed = parseFloat(document.getElementById("inputReplayspeed").value);
        if (isNaN(replaySpeed)) {
            replaySpeed = 1;
            document.getElementById("inputReplayspeed").innerHTML = "1";
        }
        
        var scenarioFile = "";
        var selector = document.getElementById("dropdownScenario");
        var selIdx = selector.selectedIndex;
        if (selIdx == 0) {
            scenarioFile = "loadevents_prefixsums-2713799";
        }
        if (selIdx == 1) {
            scenarioFile = "loadevents_supermuc_oscillating";
        }
        if (selIdx == 2) {
            scenarioFile = "loadevents_1600x1-400jobs";
        }
        if (selIdx == 3) {
            scenarioFile = "loadevents_mallotane-g0.5";
        }
        if (selIdx == 4) {
            scenarioFile = "loadevents";
        }
        document.getElementById("explanation").innerHTML = selector.options[selector.selectedIndex].value;
        selector.style.display = "none";
        
        readTextFileThenMain(scenarioFile);
        document.getElementById("buttonStart").innerHTML = "Start";
        document.getElementById("controlpanel").style.display = "block";
        document.getElementById("inputReplayslider").value = 0.0;
        document.getElementById("inputReplayslideMin").value = 0.0;
        document.getElementById("inputReplayslideMax").value = 60.0;
        started = true;
    } else {
        isPaused = !isPaused;
        if (isPaused) {
            lastCall = null;
        } else {
            replaySpeed = parseFloat(document.getElementById("inputReplayspeed").value);
            if (isNaN(replaySpeed)) replaySpeed = 1;
        }
        updateSlider();
        document.getElementById("buttonStart").innerHTML = isPaused ? "Resume" : "Pause";
    }

    // stop the event propagating to the body element
    var evt = e ? e : window.event;
    if (evt.stopPropagation) {evt.stopPropagation();}
    else {evt.cancelBubble=true;}
    return false;
}

function togglePlay(e) {
    if (e.key === "Enter" || e.key === "Space") {
        var wasPaused = isPaused;
        if (!wasPaused) isPaused = true;
        parsed = parseFloat(document.getElementById("inputReplayspeed").value);
        if (!isNaN(parsed)) replaySpeed = parsed;
        if (!wasPaused) isPaused = false;
        return true;
    }
}

function onReplaySpeedChange() {
    // Pause if replay speed is set to zero
    if (!isPaused && document.getElementById("inputReplayspeed").value == 0) 
        onStartPauseResume();
    // Resume if it was paused before 
    else if (isPaused) onStartPauseResume();
}

function onReplaySpotChange() {
    
    if (!started) return;
    
    var min = parseFloat(document.getElementById("inputReplayslideMin").value);
    var max = parseFloat(document.getElementById("inputReplayslideMax").value);
    if (max < min) return;
    
    var sliderShare = 0.01 * parseInt(document.getElementById("inputReplayslider").value);
    var tDest = min + sliderShare * (max-min);
    
    //console.log("Min: " + min + ", max: " + max + ", slider share: " + sliderShare + ", tDest: " + tDest);
    
    jumpToTime(tDest);
}

function updateSlider() {
    var inputMin = document.getElementById("inputReplayslideMin");
    var inputMax = document.getElementById("inputReplayslideMax");
    var slider = document.getElementById("inputReplayslider");

    if (inputMin.value > replayTime) inputMin.value = replayTime;
    if (inputMax.value < replayTime) inputMax.value = replayTime;
    slider.value = inputMax.value - inputMin.value <= 0 ? 0 :
        Math.round(100 * (replayTime-inputMin.value) / (inputMax.value-inputMin.value));
    
    inputMin.disabled = !isPaused;
    inputMax.disabled = !isPaused;
    slider.disabled = !isPaused;
    if (slider.disabled) {
        var hint = "Pause the execution to enable this feature.";  
        inputMin.title = hint;
        inputMax.title = hint;
        slider.title = hint;
    } else {
        inputMin.removeAttribute("title");
        inputMax.removeAttribute("title");
        slider.removeAttribute("title");
    }
}



//////////////////////////////////////////////////////////////////////////////////////////

var seed = 195682952;
function rng() {
    seed = (seed*17) ^ 294867291;
    return (seed % 100000) * 0.00001;
}

function randomColor() {
  var r = 220;
  var g = 220;
  var b = 220;
  while (r+g+b > 400 || r+g+b < 200) {
    var r = Math.round(rng()*255);
    var g = Math.round(rng()*255);
    var b = Math.round(rng()*255);
  }
  var colstr = 'rgb(' + r + ',' + g + ',' + b + ')';
  return colstr;
}

function readTextFileThenMain(file)
{
    var rawFile = new XMLHttpRequest();
    rawFile.open("GET", file, false);
    rawFile.onreadystatechange = function ()
    {
        if(rawFile.readyState === 4)
        {
            if(rawFile.status === 200 || rawFile.status == 0)
            {
                var allText = rawFile.responseText;
                main(allText);
            }
        }
    }
    rawFile.send(null);
}

//////////////////////////////////////////////////////////////////////////////////////////

// two.js structures
var two;
var tttwo;
var gLines;
var gNodes;
var gTexts;
var gMiniLines;
var gMiniNodes;
var gMiniTexts;

var nodes = Array();
var num_busy = 0;

var miniNodes = Array();
var miniLines = Array();
var miniTexts = Array();

var jobs = new Map();
var jobvolumes = new Map();
var activejobids = new Set();
var num_finished = 0;

x = Array();
y = Array();

const COLOR_IDLE = '#DDDDDD';
const COLOR_IDLE_HIGHLIGHTED = '#888888';

const HOVER_NONE = -2;
const JOB_ID_IDLE = -1;

var hover = {
    jobid: HOVER_NONE,
    jobidx: -1,
    rank: -1,
    dirty: false
};

function getDepth(rank) {
    return Math.floor(Math.log2(rank+1));
}

function getOpacity(depth) {
    return Math.pow(1.5, -1*depth);
}

function turnNodeIdle(i) {
    if (hover.jobid == nodes[i].jobid) hover.dirty = true;
    nodes[i].fill = COLOR_IDLE;
    nodes[i].linewidth = 0;
    nodes[i].radius = 6;
    nodes[i].jobid = JOB_ID_IDLE;
    updateNodeOpacity(i);
    updateTooltip(i);
    if (hover.jobid == nodes[i].jobid) hover.dirty = true;
}

function bindNodeToJob(i, job, jobidx) {
    if (hover.jobid == nodes[i].jobid) hover.dirty = true;
    var depth = Math.floor(Math.log2(jobidx+1));
    nodes[i].fill = job.fcolor;
    nodes[i].linewidth = job.strokewidth;
    nodes[i].stroke = job.scolor;
    nodes[i].radius = Math.max(12 - 1.5*depth, 3);
    nodes[i].jobid = job.id;
    nodes[i].jobidx = jobidx;
    updateNodeOpacity(i);
    updateTooltip(i);
    if (hover.jobid == nodes[i].jobid) hover.dirty = true;
}

function updateNodeOpacity(i) {
    var jobid = nodes[i].jobid;
    nodes[i].text.value = "";
    if (hover.jobid == jobid) {
        // Highlight this node
        nodes[i].opacity = 2 * nodes[i].originalOpacity;
        if (jobid == JOB_ID_IDLE) {
            //nodes[i].fill = COLOR_IDLE_HIGHLIGHTED;
        } else {
            nodes[i].text.value = "" + nodes[i].jobidx;
            nodes[i].text.value = "" + i;
        }

    } else if (hover.jobid == HOVER_NONE) {
        // No hovering: no highlighting
        nodes[i].opacity = nodes[i].originalOpacity;
        if (jobid == JOB_ID_IDLE) {
            nodes[i].fill = COLOR_IDLE;
        }
    } else {
        // A job (or idle status) is highlighted: Lowlight this node
        nodes[i].opacity = 0.2 * nodes[i].originalOpacity;
        if (jobid == JOB_ID_IDLE) {
            nodes[i].fill = COLOR_IDLE;
        }
    }
}

function getTreeDistance(hoveridx, connidx) {
    if (hoveridx == connidx) return 0;
    var dist = 0;
    
    if (hoveridx > connidx) {
        while (hoveridx > connidx) {
            dist++;
            hoveridx = Math.floor((hoveridx-1)/2);
        }
        if (hoveridx != connidx) return 999;
        return dist;
    }
    
    var first = true;
    while (hoveridx < connidx) {
        if (!first) dist++;
        else first = false;
        connidx = Math.floor((connidx-1)/2);
    }
    if (hoveridx != connidx) return 999;
    
    return dist;
}

function updateConnectionOpacities(job) {
    if (hover.jobid == job.id) {
        // Set all "base" opacities of connections with infinite distance
        for (var j = 0; j < job.connections.length; j++) {
            var conn = job.connections[j];
            if (conn == null) continue;
            conn.linewidth = Math.max(1, 15 * getOpacity(getDepth(j)));
            conn.opacity = 0;
        }
        // Compute close connections
        var jobidx = hover.jobidx;
        var opacity = 1;
        // Go upwards
        while (jobidx >= 0) {
            var conn = job.connections[jobidx];
            if (conn != null) conn.opacity = opacity;
            jobidx = jobidx == 0 ? -1 : Math.floor((jobidx-1)/2);
            opacity = Math.max(0.2, 0.67*opacity);
        }
        // Go downwards {left, right}
        indices = Array();
        indices.push(2*hover.jobidx+1);
        indices.push(1);
        indices.push(2*hover.jobidx+2);
        indices.push(1);
        while (indices.length > 0) {
            var opacity = indices.pop();
            var jobidx = indices.pop();
            var conn = job.connections[jobidx];
            if (conn != null) {
                conn.opacity = opacity;
                opacity = Math.max(0.2, 0.67*opacity);
                indices.push(2*jobidx+1);
                indices.push(opacity);
                indices.push(2*jobidx+2);
                indices.push(opacity);
            }
        }
    } else {
        for (var j = 0; j < job.connections.length; j++) {
            updateConnectionOpacity(job, j);
        }
    }
}
function updateConnectionOpacity(job, j) {
    var conn = job.connections[j];
    if (conn == null) return;
    var dist = 0;
    if (hover.jobid == job.id && hover.jobidx != j) {
        // Compute parent-child distance between indices
        dist = getTreeDistance(hover.jobidx, j);
    }
    if (job.id == hover.jobid) {
        conn.opacity = dist >= 999 ? 0 : Math.max(0.2, getOpacity(dist));
        conn.linewidth = Math.max(1, 15 * getOpacity(getDepth(j)));
    } else if (hover.jobid == HOVER_NONE) {
        conn.opacity = conn.originalOpacity;
        conn.linewidth = 2;
    } else {
        conn.opacity = 0;
    }
}

function updateHover() {
    if (hover.rank == -1) {
        hover.jobid = HOVER_NONE;
    } else {
        var node = nodes[hover.rank];
        hover.jobid = node.jobid;
        hover.jobidx = node.jobidx;
    }
    for (var j = 0; j < nodes.length; j++) {
        updateNodeOpacity(j);
    }
    for (const [jid, job] of jobs) {
        updateConnectionOpacities(job);
    }
}

function getTooltip() {
    return document.getElementById('tooltip');
}
function getTooltipText() {
    return document.getElementById('tooltiptext');
}

function getRelWidthOfMiniNode(idxWithinLayer, layerSize, totalWidth, widthOffset) {
    return (10 + ((idxWithinLayer+0.5) / layerSize) * totalWidth) + widthOffset;
}
function getRelHeightOfMiniNode(layer) {
    return 20 + 30 * layer;
}

function getWidthDifference(layerSize, totalWidth) {
    // width difference between leftmost and rightmost node in a layer
    return Math.abs(getRelWidthOfMiniNode(0, layerSize, totalWidth, 0) - getRelWidthOfMiniNode(layerSize-1, layerSize, totalWidth, 0));
}    

function updateTooltip(i) {
    if (i < 0 || hover.rank != i) return;
    
    var tt = getTooltip();
    var ttt = document.getElementById('tooltiptext');
    tt.style.top = Math.min(y[i]-10, document.getElementById('myDiv').offsetHeight);
    tt.style.left = x[i]+20;
    tt.style.display = "block";
    
    var node = nodes[i];
    if (node.jobid == JOB_ID_IDLE) {
        ttt.innerHTML = "Rank " + i + " : idle<br/>(<b>" + (num_nodes - num_busy) + "</b> nodes idling)";
        document.getElementById('tooltipcanvas').style.width = 0;
        document.getElementById('tooltipcanvas').style.height = 0;
        document.getElementById('tooltipcanvas').style.display = 'none';
        return;
    } 

    var job = jobs.get(node.jobid);
    var subvolume = 1;
    var indices = Array();
    var unknownIndices = Array();
    var missingIndices = Array();

    indices.push(2*node.jobidx+1);
    indices.push(2*node.jobidx+2);
    for (var k = 0; k < indices.length; k++) {
        jobidx = indices[k];
        if (typeof job.connections[jobidx] != "undefined" && job.connections[jobidx] != null) {
            subvolume++;
            indices.push(2*jobidx+1);
            indices.push(2*jobidx+2);
        }
        if (jobidx < job.ranks.length && job.ranks[jobidx] >= 0) {
            // There is a valid rank for this job index: 
            // all previously seen "holes" are missing indices
            for (const jidx of unknownIndices) missingIndices.push(jidx);
            unknownIndices = Array();
        } else {
            // There is no valid rank for this index: Add to unknown indices
            unknownIndices.push(jobidx);
        }
    }

    ttt.innerHTML = "Rank " + i + " : Job <b>#" + node.jobid + ":" + node.jobidx + "</b><br/>"
        + "Volume: <b>" + jobvolumes.get(node.jobid) + "</b><br/>"
        + "Subtree volume: <b>" + subvolume + "</b>"
        + (missingIndices.length > 0 ? "<br/><b>Missing indices: " + missingIndices.toString() + "</b>" : "");
    
    var wMax = 0;
    var layer = 0;
    var layerSize = 1;
    var layerIdx = 0;
    for (var idx = 0; idx < job.ranks.length; idx++) {
        var rank = job.ranks[idx];
        if (rank >= 0) wMax = 10 + 10 * layerSize;
        layerIdx++;
        if (layerIdx == layerSize) {
            layerSize *= 2;
            layer++;
            layerIdx = 0;
        }
    }

    var maxLayerSize = layerSize;

    var layer = 0;
    var layerSize = 1;
    var layerIdx = 0;
    var nonemptyLayers = 0;

    //const maxDepth = Math.floor(Math.log2(n));
    //const maxLayerSize = 10 + 10 * Math.pow(2, maxDepth);
    //if (getWidthDifference(maxLayerSize, wMax) > 800) {
    if (wMax > 800) {
        console.log("Warning: Tooltip width may be too small for the mini tree");
        //widthOffset = (800 - getWidthDifference(maxLayerSize, wMax)) / 2;
        widthOffset = (800 - wMax) / 2;
        //console.log("Width offset:", widthOffset);
    } else {
        widthOffset = 0;
    }

    for (var idx = 0; idx < Math.max(job.ranks.length, miniNodes.length); idx++) {

        if (idx >= miniNodes.length) {
            if (idx > 0) {
                miniLines[idx] = tttwo.makeLine(0, 0, 0, 0);
                gMiniLines.add(miniLines[idx]);
            }
            miniNodes[idx] = tttwo.makeCircle(0, 0, 5);
            gMiniNodes.add(miniNodes[idx]);
            miniTexts[idx] = new Two.Text("", 0, 0);
            miniTexts[idx].size = 9;
            miniTexts[idx].rotation = Math.PI / 2.0;
            miniTexts[idx].alignment = 'left';
            gMiniTexts.add(miniTexts[idx]);
        }
        
        if (idx < job.ranks.length && job.ranks[idx] >= 0) {
            
            var rank = job.ranks[idx];
            var w = getRelWidthOfMiniNode(layerIdx, layerSize, wMax, widthOffset);
            var h = getRelHeightOfMiniNode(layer);
            nonemptyLayers = layer;

            var sizeModifier = idx == node.jobidx ? 1 : 0.5; 
            miniNodes[idx].fill = job.fcolor;
            miniNodes[idx].radius = sizeModifier * 5;
            miniNodes[idx].linewidth = sizeModifier * job.strokewidth;
            miniNodes[idx].stroke = job.scolor;
            miniNodes[idx].opacity = 1.0;
            miniNodes[idx].translation.x = w;
            miniNodes[idx].translation.y = h;
            //miniNodes[idx].radius = 0.5 * Math.max(12 - 1.5*layer, 3);
            if (idx > 0) {
                var wParent = getRelWidthOfMiniNode(Math.floor(layerIdx/2), layerSize/2, wMax, widthOffset);
                var hParent = getRelHeightOfMiniNode(layer-1);
                miniLines[idx].stroke = job.fcolor;
                var boldConnection = job.connections[idx] != 'undefined' 
                && job.connections[idx] != null
                && job.connections[idx].opacity > 0;
                miniLines[idx].opacity = boldConnection ? 1.0 : 0.4;
                miniLines[idx].linewidth = boldConnection ? 2 : 1;
                miniLines[idx].vertices[0].x = wParent;
                miniLines[idx].vertices[0].y = hParent;
                miniLines[idx].vertices[1].x = w;
                miniLines[idx].vertices[1].y = h;
            }
            miniTexts[idx].value = String(rank);
            miniTexts[idx].opacity = 1.0;
            miniTexts[idx].translation.x = w;
            miniTexts[idx].translation.y = h+(idx == node.jobidx ? 7 : 4);
            miniTexts[idx].size = idx == node.jobidx ? 11 : 7;

        } else {
            miniNodes[idx].opacity = 0.0;
            miniTexts[idx].opacity = 0.0;
            if (idx > 0) miniLines[idx].opacity = 0.0;
        }

        layerIdx++;
        if (layerIdx == layerSize) {
            layerSize *= 2;
            layer++;
            layerIdx = 0;
        }
    }

    document.getElementById('tooltipcanvas').style.width = 20 + wMax;
    document.getElementById('tooltipcanvas').style.height = 30 + getRelHeightOfMiniNode(nonemptyLayers);
    document.getElementById('tooltipcanvas').style.display = 'block';
    // Clamp y position of tooltip in order to not flow out of the top/bottom of the viewport
    tt.style.top = Math.max(10, Math.min(y[i]-10, document.getElementById('myDiv').offsetHeight - getTooltip().offsetHeight - 40));
    if (x[i]+20+tt.offsetWidth > document.getElementById('myDiv').offsetWidth && x[i]-20-tt.offsetWidth >= 0) {
        // Too far right: pop in the tooltip to the left, not the right, of the node
        tt.style.left = x[i]-20-tt.offsetWidth;
    }
    tttwo.update();
}

function addConnections(job, jobidx) {    
    // Add connection as parent to left child
    addConnection(job, 2*jobidx+1);
    // Add connection as parent to right child
    addConnection(job, 2*jobidx+2);
    // Add connection as child to parent
    addConnection(job, jobidx);
}

function addConnection(job, chlidx) {
    if (chlidx == 0) return;
    var jnodes = job.ranks;
    if (chlidx >= jnodes.length || jnodes[chlidx] < 0 || typeof jnodes[chlidx] == 'undefined') return;
    var paridx = Math.floor((chlidx-1)/2);
    if (paridx >= jnodes.length || jnodes[paridx] < 0 || typeof jnodes[paridx] == 'undefined') return;
    
    removeConnection(job, chlidx);
    
    var parrank = jnodes[paridx];
    var chlrank = jnodes[chlidx];
    var depth = Math.floor(Math.log2(paridx+1));
    var conns = job.connections;
    //console.log("connect " + parrank + "," + chlrank)
    
    conns[chlidx] = two.makeLine(x[parrank], y[parrank], x[chlrank], y[chlrank]);
    conns[chlidx].opacity = getOpacity(depth);
    conns[chlidx].originalOpacity = conns[chlidx].opacity;
    conns[chlidx].stroke = job.fcolor;
    conns[chlidx].linewidth = 2;
    gLines.add(conns[chlidx]);
    updateConnectionOpacity(job, chlidx);
}

function removeConnection(job, chlidx) {
    if (chlidx < job.connections.length && job.connections[chlidx] != null) {
        gLines.remove(job.connections[chlidx]);
        job.connections[chlidx] = null;
    }
}

function getNodeElem(rank) {
    //console.log(nodes[rank].id);
    var elem = document.getElementById(nodes[rank].id);
    return elem;
}
function getNodeTextElem(rank) {
    var elem = document.getElementById(nodes[rank].text.id);
    return elem;
}

function advance(ev, flowOfTime) {
    
    var l = flowOfTime < 0 ? 1 - ev.load : ev.load;
    
    if (l < 1) {
                
        // Node becomes idle
        if (nodes[ev.rank].jobid == JOB_ID_IDLE) {
            const errmsg = ev + " : rank is already idle!";
            alert(errmsg);
            throw new Error(errmsg);
        }
        turnNodeIdle(ev.rank);
        
        if (!jobs.has(ev.jobid)) {
            console.log(ev);
            alert("Unfortunately, an error occurred. The event file seems to contain an inconsistency.");
        }
        
        var job = jobs.get(ev.jobid);
        removeConnection(job, ev.jobidx);
        removeConnection(job, 2*ev.jobidx+1);
        removeConnection(job, 2*ev.jobidx+2);
        job.ranks[ev.jobidx] = -1;
        jobvolumes.set(ev.jobid, jobvolumes.get(ev.jobid)-1);
        num_busy--;
        
        if (jobvolumes.get(ev.jobid) == 0) {
            //console.log("Remove " + ev.jobid + " : triggered by " + JSON.stringify(ev));
            activejobids.delete(ev.jobid);
            if (flowOfTime > 0) num_finished++;
            for (var j = 0; j < jobs.get(ev.jobid).connections.length; j++) {
                removeConnection(jobs.get(ev.jobid), j);
            }
            jobs.delete(ev.jobid);
        }
        
        //console.log("- " + JSON.stringify(ev) + " : vol " + jobvolumes.get(ev.jobid));
        
    } else {
        
        // Node becomes busy
        if (nodes[ev.rank].jobid != JOB_ID_IDLE) {
            const errmsg = ev + " : rank is already busy!";
            alert(errmsg);
            throw new Error(errmsg);
        }
        
        if (!jobs.has(ev.jobid)) {
            // Create new job
            //console.log("Introduce " + ev.jobid + " : triggered by " + JSON.stringify(ev));
            seed = ev.jobid;
            var job = {
                id: ev.jobid,
                fcolor: randomColor(),
                scolor: randomColor(),
                strokewidth: rng() * 8,
                //strokewidth: 0,
                ranks: new Array(),
                connections: new Array()
            };
            jobs.set(ev.jobid, job);
            activejobids.add(ev.jobid);
            if (flowOfTime < 0) num_finished--;
            jobvolumes.set(ev.jobid, 0);
        }
        
        var job = jobs.get(ev.jobid);
        jobvolumes.set(ev.jobid, jobvolumes.get(ev.jobid)+1);
        job.ranks[ev.jobidx] = ev.rank;
        bindNodeToJob(ev.rank, job, ev.jobidx);        
        addConnections(job, ev.jobidx);
        num_busy++;
        
        //console.log("+ " + JSON.stringify(ev) + " : vol " + jobvolumes.get(ev.jobid));
    }
}

function jumpToTime(destTime) {

    var forwardTime = destTime >= replayTime;
    var nextEvIdx = lastEvIdx;
    if (forwardTime && lastDirectionForward) nextEvIdx++;
    if (!forwardTime && !lastDirectionForward) nextEvIdx--;
    
    var change = false;
    while (nextEvIdx >= 0 && nextEvIdx < events.length && 
        (
            (forwardTime && events[nextEvIdx].time <= destTime)
            || 
            (!forwardTime && events[nextEvIdx].time >= destTime)
        )
    ) {
        var loadEvent = events[nextEvIdx];
        console.log(loadEvent);
        advance(loadEvent, forwardTime ? 1 : -1);
        lastEvIdx = nextEvIdx;
        nextEvIdx = lastEvIdx + (forwardTime ? 1 : -1);
        change = true;
    }

    replayTime = destTime;
    
    if (change) {
        lastDirectionForward = forwardTime;
    
        if (hover.dirty) {
            updateHover();
            updateTooltip(hover.rank);
            hover.dirty = false;
        }

        document.getElementById("activejobsdisplay").innerHTML = String(activejobids.size);
        document.getElementById("exitedjobsdisplay").innerHTML = String(num_finished);
        document.getElementById("busynodesdisplay").innerHTML = num_busy;
        document.getElementById("systemloaddisplay").innerHTML = Math.round(100*100*num_busy/num_nodes) / 100;
    }

    document.getElementById("timedisplay").innerHTML = String(Math.round(1000*replayTime)/1000);
}

function main(updates) {

    // Read full history
    var lines = updates.split('\n');
    var lineidx = 0;
    num_nodes = 0;
    for (var lineidx = 0; lineidx < lines.length; lineidx++) {
        var line = lines[lineidx].split(" ");
        if (line.length < 5) continue;
        var loadEvent = {
            time: parseFloat(line[0]),
            rank: parseInt(line[1]),
            load: parseInt(line[2]),
            jobid: parseInt(line[3]),
            jobidx: parseInt(line[4])
        };
        events.push(loadEvent);
        num_nodes = Math.max(num_nodes, loadEvent.rank);
    }
    num_nodes++;
    
    document.getElementById("numnodesdisplay").innerHTML = num_nodes;
    var num_rows = Math.ceil(0.9 * Math.sqrt(num_nodes));
    var num_cols = Math.ceil(num_nodes / num_rows);
    console.log(num_rows + ' rows, ' + num_cols + ' cols');

    // Set up two.js
    var elem = document.getElementById('myDiv');
    elem.style.display = "block";
    var params = { width: 30*(num_cols+2), height: 30*(num_rows+2) };
    two = new Two(params).appendTo(elem);
    gLines = two.makeGroup();
    gNodes = two.makeGroup();
    gTexts = two.makeGroup();

    var ttelem = document.getElementById('tooltipcanvas');
    var ttparams = { width: (num_nodes/2 + 1)*20+20, height: getRelHeightOfMiniNode(Math.log2(num_nodes/2 + 1))+20 };
    tttwo = new Two(ttparams).appendTo(ttelem);
    gMiniLines = tttwo.makeGroup();
    gMiniNodes = tttwo.makeGroup();
    gMiniTexts = tttwo.makeGroup();
    ttelem.style.display = 'none';
    ttelem.style.width = 0;
    ttelem.style.height = 0;

    // Set up grid of (idle) nodes
    var col = 0;
    var row = 0;
    for (var i = 0; i < num_nodes; i++) {
        
        // Coordinates of this node
        y[i] = 30 * (row+1);
        x[i] = 30 * (col+1);
        
        // Node object
        nodes[i] = two.makeCircle(x[i], y[i], 2);
        gNodes.add(nodes[i]);
        nodes[i].originalOpacity = 1;
        
        // Text object indicating the node's index within a job
        // (on hover only)
        var text = new Two.Text("", x[i], y[i]-13);
        text.size = 11;
        gTexts.add(text);
        nodes[i].text = text;
        
        // Render node as idle
        turnNodeIdle(i);
        
        // Update column + row indices
        if (col == num_cols) {
            col = 0;
            row++;
        } else col++;
    }
    
    // Initial rendering
    two.update();
    tttwo.update();
    updateSlider();
    
    // Set up hover action for each node
    for (var i = 0; i < num_nodes; i++) {
        
        ((i, nodes, jobs, hover, x, y) => {

        var callbackOn = event => {
            hover.rank = i;
            updateHover();
            updateTooltip(i);
        }
        var callbackOff = event => {
            hover.rank = -1;
            updateHover();
            getTooltip().style.display = 'none';
        }
        var callbackToggle = e => {
            if (hover.rank == i) {
                hover.rank = -1;
                updateHover();
                getTooltip().style.display = 'none';
            } else {
                hover.rank = i;
                updateHover();
                updateTooltip(i);
            }
            // stop the event propagating to the body element
            var evt = e ? e : window.event;
            if (evt.stopPropagation) {evt.stopPropagation();}
            else {evt.cancelBubble=true;}
            return false;
        }

        //getNodeElem(i).addEventListener("mouseover", callbackOn);
        //getNodeTextElem(i).addEventListener("mouseover", callbackOn);
        //getNodeElem(i).addEventListener("mouseout", callbackOff);
        //getNodeTextElem(i).addEventListener("mouseout", callbackOff);
        getNodeElem(i).onclick = callbackToggle;
        getNodeTextElem(i).onclick = callbackToggle;
            
        })(i, nodes, jobs, hover, x, y);
    }
    
    // Add listener for key presses
    document.getElementById("inputReplayspeed").addEventListener("keyup", ({key}) => {
        if (key === "Enter") {
            isPaused = true;
            parsed = parseFloat(document.getElementById("inputReplayspeed").value);
            if (!isNaN(parsed) && replaySpeed != 0) replaySpeed = parsed;
            isPaused = false;
        }
    });
    //document.getElementById("myDiv").addEventListener("keydown", togglePlay);
    //document.getElementsByTagName('body')[0].addEventListener("keyup", togglePlay);
    document.getElementsByTagName('body')[0].onclick = function() {
        hover.rank = -1;
        updateHover();
        getTooltip().style.display = 'none';
    };

    // Set up main update loop
    two.bind('update', function(frameCount) {
    
        if (isPaused || Math.abs(replaySpeed) == 0) return;
        
        // How much time passed since the last update?
        var now = new Date();
        var slice = lastCall == null ? 0 : (now - lastCall) * 0.001;
        var destTime = Math.max(0, replayTime + replaySpeed * slice);

        // Process all updates up to the present time
        jumpToTime(destTime);

        lastCall = now;
        updateSlider();
    
    }).play();
}
