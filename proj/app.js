import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { vec2 } from "../../libs/MV.js";

var gl;
var canvas;
var draw_program;
var num_segments = 5; 
var curve_control_points = [];
var freehand_points = [];
var persistentCurves = [];
var persistentFreehand = [];
var persistentColors = []; // Array to store colors for each curve
var pointSize = 12.0;

const MAX_CONTROL_POINTS = 256;
const MAX_POINTS = 60000;
let pointIndexArray = new Float32Array(MAX_POINTS);
let isMouseDown = false;
let isMouseMoved = false; // Variable to track if mouse has moved
let pointBuffer;
let bufferPosition = 0; // Keep track of current position in the buffer

// Function to generate a random color
function getRandomColor() {
    const r = Math.random();
    const g = Math.random();
    const b = Math.random();
    return [r, g, b, 1.0]; // RGBA
}

// Create the buffer and initialize it with indices
function createBuffer() {
    for (let i = 0; i < MAX_POINTS; i++) {
        pointIndexArray[i] = i;
    }

    // Create the WebGL buffer
    pointBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, pointIndexArray, gl.DYNAMIC_DRAW);
}

function resize(target) {
    const width = target.innerWidth;
    const height = target.innerHeight;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
}

function setup(shaders) {
    canvas = document.getElementById("gl-canvas");
    gl = setupWebGL(canvas, { alpha: true });

    draw_program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Create buffer
    createBuffer();

    window.addEventListener("resize", (event) => {
        resize(event.target);
    });

    function get_pos_from_mouse_event(canvas, event) {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / canvas.width * 2 - 1;
        const y = -((event.clientY - rect.top) / canvas.height * 2 - 1);
        return vec2(x, y);
    }

    // Mouse events
    window.addEventListener("mousedown", (event) => {
        const pos = get_pos_from_mouse_event(canvas, event);
        isMouseDown = true; // Reset mouse movement tracker
        curve_control_points.push(pos);
        console.log("Point added:", pos);

    });

    window.addEventListener("mousemove", (event) => {
        if (isMouseDown) {
            const pos = get_pos_from_mouse_event(canvas, event);
            freehand_points.push(pos);
            console.log("Freehand point added:", pos);
            isMouseMoved = true;
        }
    });

    window.addEventListener("mouseup", () => {
        isMouseDown = false;
        if (isMouseMoved) {
            if (freehand_points.length > 0) {
                storePointsInBuffer(freehand_points);
                 // Store freehand points in the persistent array
                persistentFreehand.push([...freehand_points]);
                freehand_points = [];
            }
        }
    });

    window.addEventListener("keydown", (event) => {
        if (event.key === 'z') {
            if (curve_control_points.length >= 4) {
                persistentCurves.push([...curve_control_points]);
                persistentColors.push(getRandomColor()); // Assign a random color for this curve
                curve_control_points = [];
            }
        }
    });

    resize(window);
    gl.clearColor(0.0, 0.0, 0.0, 1);

    window.requestAnimationFrame(animate);
}

let last_time;

function animate(timestamp) {
    window.requestAnimationFrame(animate);

    if (last_time === undefined) {
        last_time = timestamp;
    }
    const elapsed = timestamp - last_time;

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(draw_program);

    // Render persistent curves
    for (let i = 0; i < persistentCurves.length; i++) {
        drawCurve(persistentCurves[i], persistentColors[i]);
    }

    for(const line of persistentFreehand){
        drawFreehand(line,getRandomColor());
    }

    // Render freehand points in real-time
    if (freehand_points.length > 1) {
        drawFreehand(freehand_points, [1,1,1,1]);
    }

    // Render control point curves
    if (curve_control_points.length >= 4) {
        drawCurve(curve_control_points, [1, 1, 1, 1]);
    }

    last_time = timestamp;
}

function drawFreehand(points, color) {
    if (points.length >= 4) {
        drawCurve(points, color);  // Usa a função de interpolação B-Spline
    }
}

// Store points in buffer
function storePointsInBuffer(points) {
    const flattenedPoints = [];
    for (let i = 0; i < points.length; i++) {
        flattenedPoints.push(points[i][0], points[i][1]);
    }

    if (bufferPosition + flattenedPoints.length > MAX_POINTS) {
        console.warn("Buffer limit exceeded.");
        return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, bufferPosition * Float32Array.BYTES_PER_ELEMENT, new Float32Array(flattenedPoints));
    bufferPosition += flattenedPoints.length / 2; // Each point has 2 components (x, y)
}

function drawCurve(points, color) {
    if (points.length < 4) return;

    const P = points.length - 3;
    const S = num_segments;
    const numVertices = S * P;

    const flattenedControlPoints = [];
    for (let i = 0; i < points.length; i++) {
        flattenedControlPoints.push(points[i][0], points[i][1]);
    }

    storePointsInBuffer(points);

    const controlPointsLocation = gl.getUniformLocation(draw_program, "controlPoints");
    gl.uniform2fv(controlPointsLocation, new Float32Array(flattenedControlPoints));

    const numSegmentsLocation = gl.getUniformLocation(draw_program, "numSegments");
    gl.uniform1i(numSegmentsLocation, num_segments);

    const pointSizeLocation = gl.getUniformLocation(draw_program, "pointSize");
    gl.uniform1f(pointSizeLocation, pointSize);

    // Set color for this curve
    const colorLocation = gl.getUniformLocation(draw_program, "curveColor");
    gl.uniform4fv(colorLocation, new Float32Array(color));

    gl.drawArrays(gl.POINTS, 0, numVertices);
}

loadShadersFromURLS(["shader.vert", "shader.frag"]).then(shaders => setup(shaders));
