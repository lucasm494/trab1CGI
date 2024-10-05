import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { vec2 } from "../../libs/MV.js";

var gl;
var canvas;
var aspect;
var draw_program;
var num_segments = 5; // Número de segmentos entre cada par de pontos
var mouse_positions = []; // Array para armazenar os pontos de controle
var pointSize = 5.0; // Tamanho do ponto

// Valor máximo de pontos de controle
const MAX_CONTROL_POINTS = 256;

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

    // Criar programa WebGL
    draw_program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Handle resize events
    window.addEventListener("resize", (event) => {
        resize(event.target);
    });

    // Função para capturar a posição do mouse em coordenadas WebGL
    function get_pos_from_mouse_event(canvas, event) {
        const rect = canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / canvas.width * 2 - 1;
        const y = -((event.clientY - rect.top) / canvas.height * 2 - 1);
        return vec2(x, y);
    }

    // Evento de clique para capturar as posições do mouse
    window.addEventListener("mousedown", (event) => {
        const pos = get_pos_from_mouse_event(canvas, event);
        if (mouse_positions.length < MAX_CONTROL_POINTS) {
            mouse_positions.push(pos); // Adicionar a posição ao array de pontos de controle
            console.log("Ponto adicionado: ", pos);
        } else {
            console.log("Número máximo de pontos de controle alcançado.");
        }
    });

    resize(window);

    gl.clearColor(0.0, 0.0, 0.0, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    window.requestAnimationFrame(animate);
}

function createIndexBuffer() {
    const indices = new Uint32Array(60000); // Buffer de 60.000 entradas
    for (let i = 0; i < 60000; i++) {
        indices[i] = i;
    }
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    return indexBuffer;
}

let last_time;

function animate(timestamp) {
    window.requestAnimationFrame(animate);

    if (last_time === undefined) {
        last_time = timestamp;
    }
    const elapsed = timestamp - last_time;

    gl.clear(gl.COLOR_BUFFER_BIT);

    // Desenhar a curva apenas se houver pelo menos 4 pontos de controle
    if (mouse_positions.length >= 4) {
        const P = mouse_positions.length - 3; // Número de curvas possíveis (P3, P4, etc.)
        const S = num_segments;
        const numVertices = S * P; // Total de vértices a desenhar (S segmentos por curva)

        // Usar o programa de desenho
        gl.useProgram(draw_program);

        // Configurar o buffer de índices
        createIndexBuffer();

        // Enviar os pontos de controle para o shader
        const controlPointsLocation = gl.getUniformLocation(draw_program, "controlPoints");
        const flattenedControlPoints = [];
        for (let i = 0; i < mouse_positions.length; i++) {
            flattenedControlPoints.push(mouse_positions[i][0], mouse_positions[i][1]);
        }
        // Preencher o restante com zeros até atingir o limite de 256 pontos
        for (let i = mouse_positions.length; i < MAX_CONTROL_POINTS; i++) {
            flattenedControlPoints.push(0, 0);
        }
        gl.uniform2fv(controlPointsLocation, new Float32Array(flattenedControlPoints));

        // Enviar o número de segmentos
        const numSegmentsLocation = gl.getUniformLocation(draw_program, "numSegments");
        gl.uniform1i(numSegmentsLocation, num_segments);

        // Enviar o tamanho do ponto
        const pointSizeLocation = gl.getUniformLocation(draw_program, "pointSize");
        gl.uniform1f(pointSizeLocation, pointSize);

        // Desenhar os pontos interpolados da curva B-Spline
        gl.drawArrays(gl.POINTS, 0, numVertices);
    }

    last_time = timestamp;
}



loadShadersFromURLS(["shader.vert", "shader.frag"]).then(shaders => setup(shaders));
