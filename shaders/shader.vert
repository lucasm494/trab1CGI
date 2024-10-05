#version 300 es

uniform float pointSize;  // Uniforme para o tamanho do ponto
uniform int numSegments;  // Uniforme para o número de segmentos
uniform vec2 controlPoints[256];  // Pontos de controle

void main() {
    // O valor de t é calculado com base no índice do segmento
    float t = float(gl_VertexID % numSegments) / float(numSegments);

    // Índice do ponto de controle (assumindo 4 pontos para B-Spline)
    int P = gl_VertexID / numSegments; 

    // Definir os 4 pontos de controle para a curva B-Spline
    vec2 P0 = controlPoints[P];
    vec2 P1 = controlPoints[P + 1];
    vec2 P2 = controlPoints[P + 2];
    vec2 P3 = controlPoints[P + 3];

    // Funções de blending cúbicas
    float B0 = (-t*t*t + 3.0*t*t - 3.0*t + 1.0) / 6.0;
    float B1 = (3.0*t*t*t - 6.0*t*t + 4.0) / 6.0;
    float B2 = (-3.0*t*t*t + 3.0*t*t + 3.0*t + 1.0) / 6.0;
    float B3 = (t*t*t) / 6.0;

    // Calcular a posição final da curva B-Spline
    vec2 position = B0 * P0 + B1 * P1 + B2 * P2 + B3 * P3;

    gl_Position = vec4(position, 0.0, 1.0);
    gl_PointSize = pointSize;
}
