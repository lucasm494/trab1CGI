import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { vec2 } from "../../libs/MV.js";

var gl;
var canvas;
var draw_program;
var num_segments = 30; 
var curve_control_points = [];
var freehand_points = [];
var persistentCurves = [];
var persistentFreehand = [];
var pointSize = 12.0;
var curveType = 1;

const MAX_CONTROL_POINTS = 256;
const MAX_POINTS = 60000;
let pointIndexArray = new Float32Array(MAX_POINTS);
let isMouseDown = false;
let isMouseMoved = false; // Variable to track if mouse has moved
let pointBuffer;
let bufferPosition = 0; // Keep track of current position in the buffer
let isAnimationPaused = false;// Controlar animação
let showSamplingPoints = true; // Mostrar/Ocultar pontos de amostragem
let showSegments = true; // Mostrar/Ocultar segmentos de reta
let segmentChangeRate = 1; // Taxa de mudança de segmentos

// Gravity Variables
const gravity = [0, -0.001];
let isGravityEnabled = false;

// Star Morphing Variables
let isMorphingToStar = false;
const starVertices = calculateStarVertices(5, 0.5, 1.0); // 5 points, inner radius 0.5, outer radius 1.0

// Define a movement threshold
const MOVEMENT_THRESHOLD = 0.05; // Adjust this value as needed
let lastMousePos = null; // Track the last position of the mouse

// Class for moving points with position and velocity
class MovingPoint {
    constructor(position, velocity) {
        this.position = position; // vec2 for position
        this.velocity = velocity; // vec2 for velocity
    }
}


// Function to generate a random color
function getRandomColor() {
    const r = Math.random();
    const g = Math.random();
    const b = Math.random();
    const a = Math.random(); // Generate a random opacity between 0 and 1
    return [r, g, b, a]; // RGBA
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
        lastMousePos = pos; // Initialize last mouse position
        console.log("Point added:", pos);
    });

    window.addEventListener("mousemove", (event) => {
        if (isMouseDown) {
            const pos = get_pos_from_mouse_event(canvas, event);
            const distance = lastMousePos ? Math.sqrt((pos[0] - lastMousePos[0]) ** 2 + (pos[1] - lastMousePos[1]) ** 2) : 0;

            // Only add point if it exceeds the movement threshold
            if (distance > MOVEMENT_THRESHOLD) {
                curve_control_points = [];
                freehand_points.push(pos);
                lastMousePos = pos; // Update last mouse position
                console.log("Freehand point added:", pos);
                isMouseMoved = true;
            }
        }
    });

    window.addEventListener("mouseup", () => {
        isMouseDown = false;
        if (isMouseMoved) {
            if (freehand_points.length > 0) {
                const color = getRandomColor(); // Generate color for this line
                const movingPoints = freehand_points.map(pos => new MovingPoint(pos, [Math.random() * 0.02 - 0.01, Math.random() * 0.02 - 0.01])); // Assign random velocity
                persistentFreehand.push({ points: movingPoints, color }); // Store points and color
                storePointsInBuffer(freehand_points);
                freehand_points = []; // Clear freehand points after storing
            }
        }
        lastMousePos = null; // Reset last mouse position
    });

    // Modify the keydown event listener to include new functionality
window.addEventListener("keydown", (event) => {
    switch (event.key) {
        case 'z':
            if (curve_control_points.length >= 4) {
                const movingPoints = curve_control_points.map(pos => 
                    new MovingPoint(pos, [Math.random() * 0.02 - 0.01, Math.random() * 0.02 - 0.01])
                ); 
                persistentCurves.push({ points: movingPoints, color: getRandomColor() });
                curve_control_points = [];
            }
            break;

        case 'c': // Clear all curves
            persistentCurves = [];
            persistentFreehand = [];
            bufferPosition = 0; // Reset buffer position
            break;

        case '+': // Increase the number of segments
            num_segments = Math.min(num_segments + segmentChangeRate, 50); // Limite superior
            console.log("Increased segments to:", num_segments);
            break;

        case '-': // Decrease the number of segments
            num_segments = Math.max(1, num_segments - segmentChangeRate); // Ensure num_segments doesn't go below 1
            console.log("Decreased segments to:", num_segments);
            break;

        case '>': // Increase speed
            persistentCurves.forEach(curve => {
                curve.points.forEach(point => {
                    point.velocity[0] *= 1.1; // Increase x velocity
                    point.velocity[1] *= 1.1; // Increase y velocity
                });
            });
            persistentFreehand.forEach(line => {
                line.points.forEach(point => {
                    point.velocity[0] *= 1.1; // Increase x velocity
                    point.velocity[1] *= 1.1; // Increase y velocity
                });
            });
            break;

        case '<': // Decrease speed
            persistentCurves.forEach(curve => {
                curve.points.forEach(point => {
                    point.velocity[0] *= 0.9; // Decrease x velocity
                    point.velocity[1] *= 0.9; // Decrease y velocity
                });
            });
            persistentFreehand.forEach(line => {
                line.points.forEach(point => {
                    point.velocity[0] *= 0.9; // Decrease x velocity
                    point.velocity[1] *= 0.9; // Decrease y velocity
                });
            });
            break;

        case ' ': // Toggle animation
            isAnimationPaused = !isAnimationPaused;
            console.log("Animation paused:", isAnimationPaused);
            break;

        case 'p': // Toggle showing sampling points
            showSamplingPoints = !showSamplingPoints;
            console.log("Showing sampling points:", showSamplingPoints);
            break;

        case 'l': // Toggle showing curve segments
            showSegments = !showSegments;
            console.log("Showing curve segments:", showSegments);
            break;
        case '1': //curveType -> B-Spline
            curveType = 1;
            break;
        case '2': //curveType -> Catmull Rom
            curveType = 2;
        break;
        case '3': //curveType -> Bézier
            curveType = 3;
            break;
        case 'g':
            isGravityEnabled = !isGravityEnabled;
            console.log("Gravity enabled:", isGravityEnabled);
            break;
        case 's':
            isMorphingToStar = !isMorphingToStar; // Start/stop star morphing
            console.log("Morphing to star:", isMorphingToStar);
            break;
    }
});

    resize(window);
    gl.clearColor(0.0, 0.0, 0.0, 1);

    window.requestAnimationFrame(animate);
}

// Function to calculate star vertices
function calculateStarVertices(points, innerRadius, outerRadius) {
    const vertices = [];
    const angle = Math.PI / points;
    const halfAngle = angle / 2;
    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const x = Math.cos(i * angle) * radius;
        const y = Math.sin(i * angle) * radius;
        vertices.push(vec2(x, y));
    }
    return vertices;
}

// Function to handle the morph effect
function morphToStar(points) {
    for (let i = 0; i < points.length; i++) {
        const target = starVertices[i % starVertices.length];
        const point = points[i];

        // Move the point towards the target position
        point.position[0] += (target[0] - point.position[0]) * 0.05; // Adjust 0.05 for morphing speed
        point.position[1] += (target[1] - point.position[1]) * 0.05;
    }
}

let last_time;

// Animation function
function animate(timestamp) {
    window.requestAnimationFrame(animate);

    if (last_time === undefined) {
        last_time = timestamp;
    }
    const elapsed = timestamp - last_time;

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(draw_program);

    if (!isAnimationPaused) {
        // Update moving points
        persistentCurves.forEach(curve => {
            curve.points.forEach((movingPoint) => {
                if (isGravityEnabled) {
                    movingPoint.velocity[1] += gravity[1];
                }

                movingPoint.position[0] += movingPoint.velocity[0];
                movingPoint.position[1] += movingPoint.velocity[1];

                // Add ceiling constraint
                if (movingPoint.position[1] >= 1) {
                    movingPoint.velocity[1] *= -0.7;
                    movingPoint.position[1] = 1;
                }

                if (movingPoint.position[0] >= 1 || movingPoint.position[0] <= -1) {
                    movingPoint.velocity[0] *= -1;
                }
                if (movingPoint.position[1] <= -1) {
                    movingPoint.velocity[1] *= -0.7;
                    movingPoint.position[1] = -1;
                }
            });

            if (isMorphingToStar) {
                morphToStar(curve.points);
            }

            drawCurve(curve.points.map(mp => mp.position), curve.color);
        });

        persistentFreehand.forEach(line => {
            line.points.forEach((movingPoint) => {
                if (isGravityEnabled) {
                    movingPoint.velocity[1] += gravity[1];
                }

                movingPoint.position[0] += movingPoint.velocity[0];
                movingPoint.position[1] += movingPoint.velocity[1];

                // Add ceiling constraint
                if (movingPoint.position[1] >= 1) {
                    movingPoint.velocity[1] *= -0.7;
                    movingPoint.position[1] = 1;
                }

                if (movingPoint.position[0] >= 1 || movingPoint.position[0] <= -1) {
                    movingPoint.velocity[0] *= -1;
                }
                if (movingPoint.position[1] <= -1) {
                    movingPoint.velocity[1] *= -0.7;
                    movingPoint.position[1] = -1;
                }
            });

            if (isMorphingToStar) {
                morphToStar(line.points);
            }

            drawFreehand(line.points.map(mp => mp.position), line.color);
        });
    } else {
        persistentCurves.forEach(curve => {
            drawCurve(curve.points.map(mp => mp.position), curve.color);
        });

        persistentFreehand.forEach(line => {
            drawFreehand(line.points.map(mp => mp.position), line.color);
        });
    }

    if (freehand_points.length > 1) {
        drawFreehand(freehand_points, [1, 1, 1, 1]);
    }

    if (curve_control_points.length >= 4) {
        drawCurve(curve_control_points, [1, 1, 1, 1]);
    }

    last_time = timestamp;
}

function drawFreehand(points, color) {
    if (points.length >= 4) {
        drawCurve(points, color); // Usa a função de interpolação B-Spline
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

    const curveTypeLocation = gl.getUniformLocation(draw_program,"curveType");
    gl.uniform1i(curveTypeLocation,curveType);

    const controlPointsLocation = gl.getUniformLocation(draw_program, "controlPoints");
    gl.uniform2fv(controlPointsLocation, new Float32Array(flattenedControlPoints));

    const numSegmentsLocation = gl.getUniformLocation(draw_program, "numSegments");
    gl.uniform1i(numSegmentsLocation, num_segments);

    const pointSizeLocation = gl.getUniformLocation(draw_program, "pointSize");
    gl.uniform1f(pointSizeLocation, pointSize);

    // Set color for this curve
    const colorLocation = gl.getUniformLocation(draw_program, "curveColor");
    gl.uniform4fv(colorLocation, new Float32Array(color));

    if (showSamplingPoints) {
        gl.drawArrays(gl.POINTS, 0, numVertices);
    }

    if (showSegments) {
        gl.drawArrays(gl.LINE_STRIP,0,numVertices);
    }
}



loadShadersFromURLS(["shader.vert", "shader.frag"]).then(shaders => setup(shaders));