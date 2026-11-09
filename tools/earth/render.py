"""The orbit home's static scene: src/assets/home/orbit_scene.webp.

ONE picture holds the night Earth, its atmosphere / axis / protractor /
latitude lines, and the curved part of the orbit line (the two fillets and the
arc round the Earth). The app only adds the two straight rails, the moving
checkpoints and a few text labels, so the home draws almost nothing itself.

Run from this folder: python3 texture.py && python3 render.py
(needs: pip install global-land-mask scipy pillow numpy)

Keep in sync with the app:
  * projection (TILT, BETA)                  -> src/components/orbit/globe.ts
  * path shape (PATH_R, FILLET, RAIL_DX) and
    the picture box (BOX_*)                  -> src/components/orbit/geometry.ts
Projection: body (X east, Y north, Z to the viewer on the central meridian)
  -> north pole tipped toward the viewer by BETA (rotation about X)
  -> turned in the screen plane by TILT so the axis leans right (23.44 deg).
"""
import numpy as np
from PIL import Image, ImageDraw

TILT = np.radians(23.44)
BETA = np.radians(18.0)
LON0 = 88.0            # central meridian (India / Bay of Bengal faces the viewer)
PAD = 3                # transparent margin around the rendered disc
OV_HALF = 1.55         # overlay layer half-size, in planet radii

# Orbit path, in planet radii (geometry.ts: r = 1.38 R, f = 0.45 r, rail 26/116 R right of centre)
PATH_R = 1.38
FILLET = 0.45 * PATH_R
RAIL_DX = 26 / 116
# Picture box around the Earth's centre, in planet radii (geometry.ts BOX_*)
BOX_LEFT, BOX_RIGHT, BOX_HALF_H = 1.62, 0.64, 2.0
SCENE_R = 320          # planet radius in px in the final picture

tex = np.load('texture.npy')
TH, TW, _ = tex.shape
ct, st, cb, sb = np.cos(TILT), np.sin(TILT), np.cos(BETA), np.sin(BETA)


def to_screen(lat, lon_rel):
    """(lat, lon - central lon) radians -> screen (x right, y down) in radii + depth."""
    X = np.cos(lat) * np.sin(lon_rel)
    Y = np.sin(lat)
    Z = np.cos(lat) * np.cos(lon_rel)
    Y2 = Y * cb - Z * sb
    Z2 = Y * sb + Z * cb
    xu = X * ct + Y2 * st
    yu = -X * st + Y2 * ct
    return xu, -yu, Z2


def sample(lat, lon):
    """Bilinear sample of the equirectangular texture (degrees)."""
    fy = (90 - lat) / 180 * TH - 0.5
    fx = ((lon + 180) % 360) / 360 * TW - 0.5
    y0 = np.clip(np.floor(fy).astype(int), 0, TH - 1)
    y1 = np.clip(y0 + 1, 0, TH - 1)
    x0 = np.floor(fx).astype(int) % TW
    x1 = (x0 + 1) % TW
    wy = (fy - np.floor(fy))[..., None]
    wx = (fx - np.floor(fx))[..., None]
    top = tex[y0, x0] * (1 - wx) + tex[y0, x1] * wx
    bot = tex[y1, x0] * (1 - wx) + tex[y1, x1] * wx
    return top * (1 - wy) + bot * wy


def render_frame(lon_c, size, ss=2):
    n = size * ss
    rad = (size / 2 - PAD) * ss
    c = (n - 1) / 2
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    u = (xx - c) / rad
    v = (yy - c) / rad
    rho2 = u * u + v * v
    inside = rho2 < 1
    z2 = np.sqrt(np.clip(1 - rho2, 0, 1))
    xu, yu = u, -v
    X = xu * ct - yu * st
    Y2 = xu * st + yu * ct
    Y = Y2 * cb + z2 * sb
    Z = -Y2 * sb + z2 * cb
    lat = np.degrees(np.arcsin(np.clip(Y, -1, 1)))
    lon = lon_c + np.degrees(np.arctan2(X, Z))
    rgb = sample(lat, lon)
    a = inside.astype(np.float32)
    img = np.concatenate([rgb * a[..., None], a[..., None]], -1)
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), 'RGBA')
    # downsample premultiplied, then un-premultiply
    im = im.resize((size, size), Image.LANCZOS)
    arr = np.asarray(im).astype(np.float32) / 255
    al = arr[..., 3:4]
    arr[..., :3] = np.where(al > 0.004, arr[..., :3] / np.maximum(al, 1e-4), 0)
    return Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), 'RGBA')


# ------------------------------------------------------------------ overlay
def overlay(OV_R):
    size = int(2 * OV_HALF * OV_R)
    c = (size - 1) / 2
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    u = (xx - c) / OV_R
    v = (yy - c) / OV_R
    rho = np.sqrt(u * u + v * v)
    th = np.degrees(np.arctan2(v, u)) % 360
    sun = 200.0  # sunlight grazes the left / upper-left limb
    w = ((1 + np.cos(np.radians(th - sun))) / 2) ** 2.2

    rgba = np.zeros((size, size, 4), np.float32)

    def add_over(color, alpha):
        a = np.clip(alpha, 0, 1)[..., None]
        col = np.broadcast_to(np.asarray(color, np.float32), rgba[..., :3].shape) if np.ndim(color) == 1 else color
        rgba[..., :3] = col * a + rgba[..., :3] * (1 - a)
        rgba[..., 3:4] = a + rgba[..., 3:4] * (1 - a)

    gold = np.array([255, 196, 104]) / 255
    rose = np.array([255, 120, 150]) / 255
    violet = np.array([128, 96, 255]) / 255
    blue = np.array([90, 150, 255]) / 255
    mixc = (violet[None, None] * (1 - w[..., None]) + gold[None, None] * w[..., None])
    mixc = mixc * 0.75 + rose[None, None] * 0.25 * (np.sin(np.radians(th - 120)) ** 2)[..., None]

    inside = rho < 1
    outside = ~inside
    # limb darkening on the night side
    dark = np.where(inside, 0.62 * rho ** 5 * (1 - 0.75 * w), 0)
    add_over(np.zeros(3), dark)
    # thin blue air all round + hot sunrise rim on the left
    rim_blue = np.where(inside, np.exp(-(1 - rho) / 0.045) * 0.45, 0)
    add_over(blue, rim_blue)
    rim_sun = np.where(inside, np.exp(-(1 - rho) / 0.03) * w * 1.1 + np.exp(-(1 - rho) / 0.12) * w ** 2 * 0.35, 0)
    add_over(mixc, rim_sun)
    # atmosphere halo outside the limb
    halo = np.where(outside, np.exp(-(rho - 1) / 0.035) * (0.35 + 0.65 * w) + np.exp(-(rho - 1) / 0.16) * (0.1 + 0.4 * w), 0)
    add_over(mixc, halo)
    # anti-alias the limb seam
    edge = np.exp(-((rho - 1) / 0.006) ** 2) * (0.5 + 0.5 * w)
    add_over(np.array([255, 236, 200]) / 255 * w[..., None] + blue * (1 - w[..., None]), edge * 0.8)
    # sunrise glint on the limb
    gx, gy = np.cos(np.radians(sun + 18)) * 1.0, np.sin(np.radians(sun + 18)) * 1.0
    d = np.sqrt((u - gx) ** 2 + (v - gy) ** 2)
    add_over(np.array([255, 245, 225]) / 255, np.exp(-d / 0.03) * 0.95)
    streak = np.exp(-np.abs(v - gy) / 0.006) * np.exp(-np.abs(u - gx) / 0.35) * 0.5
    streak += np.exp(-np.abs(u - gx) / 0.006) * np.exp(-np.abs(v - gy) / 0.18) * 0.35
    add_over(np.array([255, 236, 210]) / 255, streak)

    base = Image.fromarray((np.clip(rgba, 0, 1) * 255).astype(np.uint8), 'RGBA')

    # ---- line art (supersampled) ----
    SS = 3
    big = Image.new('RGBA', (size * SS, size * SS), (0, 0, 0, 0))
    dr = ImageDraw.Draw(big)
    C = (size * SS - 1) / 2
    RR = OV_R * SS
    P = lambda x, y: (C + x * RR, C + y * RR)

    def dashed(pts, color, width, dash, gap, fade=None):
        """pts: list of (x, y, alpha) in radii; dash/gap in radii."""
        acc, on = 0.0, True
        for (x0, y0, a0), (x1, y1, a1) in zip(pts, pts[1:]):
            seg = np.hypot(x1 - x0, y1 - y0)
            if on and a0 > 0.01 and a1 > 0.01:
                col = color[:3] + (int(color[3] * min(a0, a1)),)
                dr.line([P(x0, y0), P(x1, y1)], fill=col, width=int(width * SS))
            acc += seg
            if acc >= (dash if on else gap):
                acc, on = 0.0, not on

    # latitude circles (static: the spin never moves them)
    lam = np.radians(np.linspace(-180, 180, 1441))
    for la_deg, color, width, dash, gap in [
        (0.0, (160, 230, 255, 235), 2.6, 0.045, 0.024),
        (23.44, (255, 214, 130, 215), 2.3, 0.04, 0.03),
        (-23.44, (255, 214, 130, 215), 2.3, 0.04, 0.03),
        (66.56, (205, 200, 255, 140), 1.8, 0.014, 0.03),
        (-66.56, (205, 200, 255, 140), 1.8, 0.014, 0.03),
    ]:
        x, y, z = to_screen(np.radians(la_deg), lam)
        a = np.clip(z * 4, 0, 1)
        dashed(list(zip(x, y, a)), color, width, dash, gap)

    # axis through the poles, dashed, leaning TILT to the right
    ax = np.array([np.sin(TILT), -np.cos(TILT)])
    pts = [(ax[0] * s, ax[1] * s, 1.0) for s in np.linspace(-1.3, 1.34, 400)]
    dashed(pts, (255, 255, 255, 190), 2.0, 0.05, 0.03)

    # protractor at the north pole: vertical reference, 23.44 deg wedge, ticks
    pole = ax * cb  # projected north pole
    pr = 0.30
    px, py = P(*pole)
    # translucent half disc
    dr.pieslice([px - pr * RR, py - pr * RR, px + pr * RR, py + pr * RR], 180, 360, fill=(255, 255, 255, 18))
    dr.arc([px - pr * RR, py - pr * RR, px + pr * RR, py + pr * RR], 180, 360, fill=(255, 255, 255, 120), width=int(1.4 * SS))
    dr.line([P(pole[0] - pr, pole[1]), P(pole[0] + pr, pole[1])], fill=(255, 255, 255, 120), width=int(1.4 * SS))
    for deg in range(0, 181, 10):
        a = np.radians(180 + deg)
        long_tick = deg % 30 == 0
        r0 = pr - (0.07 if long_tick else 0.04)
        dr.line([P(pole[0] + np.cos(a) * r0, pole[1] + np.sin(a) * r0),
                 P(pole[0] + np.cos(a) * pr, pole[1] + np.sin(a) * pr)],
                fill=(255, 255, 255, 150 if long_tick else 95), width=int(1.2 * SS))
    # wedge between straight-up and the axis
    tilt_deg = np.degrees(TILT)
    dr.pieslice([px - 0.24 * RR, py - 0.24 * RR, px + 0.24 * RR, py + 0.24 * RR], 270, 270 + tilt_deg, fill=(255, 200, 90, 70))
    dr.arc([px - 0.24 * RR, py - 0.24 * RR, px + 0.24 * RR, py + 0.24 * RR], 270, 270 + tilt_deg, fill=(255, 210, 110, 235), width=int(2 * SS))
    # vertical reference line (dashed)
    vpts = [(pole[0], pole[1] - s, 1.0) for s in np.linspace(0, 0.46, 120)]
    dashed(vpts, (255, 255, 255, 170), 1.4, 0.03, 0.022)
    # brass pivot pin at the pole
    r = 0.022 * RR
    dr.ellipse([px - r, py - r, px + r, py + r], fill=(255, 214, 120, 255), outline=(255, 245, 210, 255), width=SS)

    lines = big.resize((size, size), Image.LANCZOS)
    base.alpha_composite(lines)
    return base


# ------------------------------------------------------------------ orbit curve
CURVE_STOPS = [(0, (255, 92, 138)), (0.28, (181, 102, 255)), (0.5, (79, 168, 255)), (0.72, (46, 230, 168)), (1, (255, 201, 74))]


def curve_color(t):
    for (t0, c0), (t1, c1) in zip(CURVE_STOPS, CURVE_STOPS[1:]):
        if t <= t1:
            k = (t - t0) / (t1 - t0)
            return tuple(int(round(a + (b - a) * k)) for a, b in zip(c0, c1))
    return CURVE_STOPS[-1][1]


def curve_points():
    """Top fillet -> arc -> bottom fillet, centred on the Earth (radii, y down)."""
    d = -RAIL_DX                                  # cx - railX
    h = np.sqrt((PATH_R + FILLET) ** 2 - (d + FILLET) ** 2)
    fx, fy = RAIL_DX - FILLET, -h                 # top fillet centre
    phi_t = np.arctan2(h, -fx)
    theta_t = np.arctan2(fy, fx) + 2 * np.pi
    pts = [(fx + FILLET * np.cos(p), fy + FILLET * np.sin(p)) for p in np.linspace(0, phi_t, 120)]
    pts += [(PATH_R * np.cos(t), PATH_R * np.sin(t)) for t in np.linspace(theta_t, 2 * np.pi - theta_t, 600)[1:]]
    pts += [(fx + FILLET * np.cos(p), -fy - FILLET * np.sin(p)) for p in np.linspace(phi_t, 0, 120)[1:]]
    return pts


def scene():
    from PIL import ImageFilter
    R = SCENE_R
    W, H = int(round((BOX_LEFT + BOX_RIGHT) * R)), int(round(2 * BOX_HALF_H * R))
    ox, oy = BOX_LEFT * R, BOX_HALF_H * R           # Earth centre in the picture
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    disc = render_frame(LON0, int(2 * (R + PAD)))
    canvas.alpha_composite(disc, (int(round(ox - disc.width / 2)), int(round(oy - disc.height / 2))))
    ov = overlay(R)
    canvas.alpha_composite(ov, (int(round(ox - ov.width / 2)), int(round(oy - ov.height / 2))))

    # orbit curve: soft glow + 2 dp core (R px = 116 dp)
    dp = R / 116
    pts = curve_points()
    n = len(pts)
    SS = 3
    for width, opacity, blur in ((9 * dp, 0.22, 2.5 * dp), (2 * dp, 1.0, 0)):
        layer = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0))
        dr = ImageDraw.Draw(layer)
        for i in range(n - 1):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            dr.line([((ox + x0 * R) * SS, (oy + y0 * R) * SS), ((ox + x1 * R) * SS, (oy + y1 * R) * SS)],
                    fill=curve_color(i / (n - 2)) + (int(255 * opacity),), width=max(1, int(round(width * SS))))
        layer = layer.resize((W, H), Image.LANCZOS)
        if blur:
            layer = layer.filter(ImageFilter.GaussianBlur(blur))
        canvas.alpha_composite(layer)
    return canvas


if __name__ == '__main__':
    import os
    img = scene()
    img.save('orbit_scene.webp', 'WEBP', quality=90, method=6)
    print(img.size, os.path.getsize('orbit_scene.webp'))
