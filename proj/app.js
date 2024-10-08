import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { vec2 } from "../../libs/MV.js";

var gl;
var canvas;
var draw_program;
var num_segments = 5; 
var curve_control_points = [];
var freehand_points = [];
var persistentCurves = [];
var persistentColors = []; // Array to store colors for each curve
var persistentFreehand = [];
var pointSize = 12.0;

const MAX_CONTROL_POINTS = 256;
let isDrawing = false;

// Function to generate a random color
function getRandomColor() {
    const r = Math.random();
    const g = Math.random();
    const b = Math.random();
    return [r, g, b, 1.0]; // RGBA
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
        if (curve_control_points.length < MAX_CONTROL_POINTS) {
            curve_control_points.push(pos);
            console.log("Curve point added:", pos);
        } else {
            console.log("Maximum number of control points reached.");
        }
        isDrawing = true;
    });

    window.addEventListener("mousemove", (event) => {
        if (isDrawing) {
            const pos = get_pos_from_mouse_event(canvas, event);
            freehand_points.push(pos);

            if (curve_control_points.length < MAX_CONTROL_POINTS) {
                curve_control_points.push(pos);
            } else {
                curve_control_points.shift(); 
                curve_control_points.push(pos); 
            }
        }
    });

    window.addEventListener("mouseup", () => {
        isDrawing = false;

        if (curve_control_points.length >= 4) {
            persistentCurves.push([...curve_control_points]); 
            persistentColors.push(getRandomColor()); // Assign a random color for this curve
            curve_control_points = [];
        }

        if (freehand_points.length > 0) {
            persistentFreehand.push([...freehand_points]);
            freehand_points = [];
        }
    });

    window.addEventListener("keydown",()=>{
        if (curve_control_points.length >= 4) {
            persistentCurves.push([...curve_control_points]); 
            persistentColors.push(getRandomColor()); // Assign a random color for this curve
            curve_control_points = [];
        }
    })

    resize(window);

    gl.clearColor(0.0, 0.0, 0.0, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

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

    for (let i = 0; i < persistentCurves.length; i++) {
        drawCurve(persistentCurves[i], persistentColors[i]);
    }

    for (const line of persistentFreehand) {
        drawFreehand(line);
    }

    if (freehand_points.length > 1) {
        drawFreehand(freehand_points);
    }

    if (curve_control_points.length >= 4) {
        drawCurve(curve_control_points);
    }

    last_time = timestamp;
}

function drawFreehand(points) {
    const flattenedPoints = [];
    for (const pos of points) {
        flattenedPoints.push(pos[0], pos[1]);
    }

    const pointsBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pointsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flattenedPoints), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(draw_program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const pointSizeLocation = gl.getUniformLocation(draw_program, "pointSize");
    gl.uniform1f(pointSizeLocation, pointSize);

    gl.drawArrays(gl.POINTS, 0, points.length);

    gl.deleteBuffer(pointsBuffer);
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
    for (let i = points.length; i < MAX_CONTROL_POINTS; i++) {
        flattenedControlPoints.push(0, 0);
    }

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
