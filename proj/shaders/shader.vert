#version 300 es

uniform float pointSize;  // Uniform for point size
uniform int numSegments;  // Uniform for number of segments
uniform vec2 controlPoints[256];  // Control points
uniform int curveType;  // Uniform for curve type (1 = B-Spline, 2 = Catmull-Rom, 3 = Bézier)

out vec4 curveColor; // Output to fragment shader

void main() {
    float t = float(gl_VertexID % numSegments) / float(numSegments);
    int P = gl_VertexID / numSegments; 

    vec2 P0 = controlPoints[P];
    vec2 P1 = controlPoints[P + 1];
    vec2 P2 = controlPoints[P + 2];
    vec2 P3 = controlPoints[P + 3];

    vec2 position;

    if (curveType == 1) {
        // B-Spline interpolation
        float B0 = (-t*t*t + 3.0*t*t - 3.0*t + 1.0) / 6.0;
        float B1 = (3.0*t*t*t - 6.0*t*t + 4.0) / 6.0;
        float B2 = (-3.0*t*t*t + 3.0*t*t + 3.0*t + 1.0) / 6.0;
        float B3 = (t*t*t) / 6.0;
        position = B0 * P0 + B1 * P1 + B2 * P2 + B3 * P3;

    } else if (curveType == 2) {
        // Catmull-Rom interpolation
        float t2 = t * t;
        float t3 = t2 * t;
        position = 0.5 * ((2.0 * P1) +
                          (-P0 + P2) * t +
                          (2.0 * P0 - 5.0 * P1 + 4.0 * P2 - P3) * t2 +
                          (-P0 + 3.0 * P1 - 3.0 * P2 + P3) * t3);

    } else if (curveType == 3) {
        // Bézier interpolation
        float u = 1.0 - t;
        float tt = t * t;
        float uu = u * u;
        float uuu = uu * u;
        float ttt = tt * t;
        position = uuu * P0 + 3.0 * uu * t * P1 + 3.0 * u * tt * P2 + ttt * P3;
    }

    gl_Position = vec4(position, 0.0, 1.0);
    gl_PointSize = pointSize;

    // Set the color for the fragment shader
    curveColor = vec4(1.0, 1.0, 1.0, 1.0); // Default color; will be replaced by the random color from the app.js
}
