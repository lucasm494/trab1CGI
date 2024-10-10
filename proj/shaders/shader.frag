#version 300 es
precision mediump float;

out vec4 fragColor;

uniform vec4 curveColor; // Pass the curve color from the vertex shader

void main() {
    // Calculate the distance from the center of the point
    float dist = length(gl_PointCoord - vec2(0.5, 0.5));

    // Set the radius for the glowing effect
    float glowRadius = 0.1;

    // Determine the alpha value based on distance
    float alpha = smoothstep(glowRadius, glowRadius - 0.1, dist); 

    // If the distance is greater than the radius, discard the fragment
    if (dist > glowRadius) {
        discard;
    }

    // Apply the glow effect with fading alpha
    fragColor = vec4(curveColor.rgb, 1.0) * (1.0 - alpha); // Base color
    fragColor += vec4(curveColor.rgb, 0.5) * alpha; // Glow effect
}
