const gpu = new GPUX();

gpu.addFunction(function normalizeVec3(x, y, z) {
    let len = Math.sqrt(x * x + y * y + z * z);
    return [x / len, y / len, z / len];
});
gpu.addFunction(function combineColors(col1, col2, alpha) {
    return [col1[0] * alpha + col2[0] * (1 - alpha), col1[1] * alpha + col2[1] * (1 - alpha), col1[2] * alpha + col2[2] * (1 - alpha)];
});

const SCREEN_WIDTH = 1000;
const SCREEN_HEIGHT = 1000;

const render = gpu.createKernel(function (numObjects, data, colors, SCREEN_WIDTH, SCREEN_HEIGHT) {
    const REFLECTION_LIMIT = 10;

    // Scale screen coords to [-1, 1]
    let screenX = ((this.thread.x / SCREEN_WIDTH) - 0.5) * 2;
    let screenY = ((this.thread.y / SCREEN_HEIGHT) - 0.5) * 2;
    // Compute ray unit vector
    let dirX = screenX;
    let dirY = screenY;
    let dirZ = -1;
    // Normalize vector to create unit vector
    let dir = normalizeVec3(dirX, dirY, dirZ);
    dirX = dir[0];
    dirY = dir[1];
    dirZ = dir[2];
    // Ray origin
    let originX = 0;
    let originY = 0;
    let originZ = 0;

    let nextOriginX = 0;
    let nextOriginY = 0;
    let nextOriginZ = 0;
    let nextDirX = 0;
    let nextDirY = 0;
    let nextDirZ = 0;

    let finalColor = [1, 1, 1];

    for (let rayCount = 0; rayCount < REFLECTION_LIMIT; rayCount++) {
        let color = [1, 1, 1];
        let t = 10000;

        // Check all objects for collision
        for (let i = 0; i < numObjects; i++) {
            let skip = false;
            let x = data[i * 4];
            let y = data[i * 4 + 1];
            let z = data[i * 4 + 2];
            let r = data[i * 4 + 3];
            // Vector from ray origin to sphere center
            let Lx = x - originX;
            let Ly = y - originY;
            let Lz = z - originZ;
            // L projected onto ray direction
            let tca = Lx * dirX + Ly * dirY + Lz * dirZ;
            if (tca < 0) {
                // Sphere is behind camera
                skip = true;
            }
            let d = Lx * Lx + Ly * Ly + Lz * Lz - tca * tca;
            if (d > r) {
                // Ray missed the sphere
                skip = true;
            }
            if (!skip) {
                let thc = Math.sqrt(r - d);
                let t0 = tca - thc;
                let t1 = tca + thc;
                // Make t0 the smaller value
                if (t0 > t1) {
                    let temp = t0;
                    t0 = t1;
                    t1 = temp;
                }
                // If t0 is negative, use t0
                if (t0 < 0) {
                    t0 = t1;
                    if (t0 < 0) {
                        skip = true;
                    }
                }
                // If this is the closest sphere to the camera, use it.
                if (t0 < t && !skip) {
                    t = t0;
                    // Compute point of intersection
                    let Px = originX + dirX * t;
                    let Py = originY + dirY * t;
                    let Pz = originZ + dirZ * t;
                    // Compute texture coordinates
                    let u = Math.floor(10 * ((Math.atan2(Px - x, Pz - z) / 3.1415) + 0.5));
                    let v = Math.floor(10 * ((Math.acos((Py - y) / r) / 3.1415) + 0.5));
                    let textColor = [colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]];
                    if ((u + v) % 2 == 0) {
                        textColor = [colors[i * 3] * .5, colors[i * 3 + 1] * .5, colors[i * 3 + 2] * .5];
                    }
                    color = textColor;
                    nextOriginX = Px;
                    nextOriginY = Py;
                    nextOriginZ = Pz;

                    let normalX = Px - x;
                    let normalY = Py - y;
                    let normalZ = Pz - z;

                    let normalDir = normalizeVec3(normalX, normalY, normalZ);
                    normalX = normalDir[0];
                    normalY = normalDir[1];
                    normalZ = normalDir[2];

                    let incidentRayDotNormal = dirX * normalX + dirY * normalY + dirZ * normalZ;

                    nextDirX = dirX - ((2.0 * incidentRayDotNormal) * normalX);
                    nextDirY = dirY - ((2.0 * incidentRayDotNormal) * normalY);
                    nextDirZ = dirZ - ((2.0 * incidentRayDotNormal) * normalZ);

                }
            }

        }

        if (t >= 10000) {
            color = [0, 0, 0];
        }
        if (color[0] == 0 && color[1] == 0 && color[2] == 0) {
            finalColor = combineColors(finalColor, finalColor, 0.0);
        } else {
            finalColor = combineColors(finalColor, color, 0.0);
        }
        if (nextDirX == 0 && nextDirY == 0 && nextDirZ == 0) {
            break;
        }
        dirX = nextDirX;
        dirY = nextDirY;
        dirZ = nextDirZ;
        originX = nextOriginX;
        originY = nextOriginY;
        originZ = nextOriginZ;

    }
    this.color(finalColor[0], finalColor[1], finalColor[2], 1);
}).setOutput([SCREEN_WIDTH, SCREEN_HEIGHT]).setGraphical(true);

let objects = [
    0, 0, -10, 1,
    3, 0, -10, 1,
    0, 0, 0, 1,
    0, 0, 0, 1,
];
let colors = [
    0, 0, 1,
    1, 0, 0,
    0, 1, 0,
    1, 0, 1,
];

render(objects.length, objects, colors, SCREEN_WIDTH, SCREEN_HEIGHT);

const canvas = render.canvas;
document.getElementsByTagName('body')[0].appendChild(canvas);

let t = 0;
let lastFrameTime = performance.now();
let fps = 0;

function renderFrame() {

    let diff = (performance.now() - lastFrameTime) / 1000;
    if (diff == 0) {
        diff = 1;
    }
    fps = 1 / diff;
    lastFrameTime = performance.now();
    fpsCounter = document.getElementById("fps-counter");
    fpsCounter.innerText = "fps: " + Math.round(fps);
    //console.log(fps);

    objects = [];
    objects = objects.concat([0, Math.sin(t * 0.5), -4, 1]);
    objects = objects.concat([Math.cos(t) * 3, 0, -4 + Math.sin(t) * 3, 1]);
    objects = objects.concat([Math.sin(t)*3, 2.5, -4+Math.cos(t)*3, 1]);
    objects = objects.concat([Math.sin(t)*3, -2.5, -4+Math.cos(t)*3, 1]);

    render(objects.length/4, objects, colors, SCREEN_WIDTH, SCREEN_HEIGHT);

    t += 0.01;
    window.requestAnimationFrame(renderFrame);
}

renderFrame();
