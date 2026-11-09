"""Equirectangular night-Earth texture (2048x1024) for the orbit home.

Real coastlines (global_land_mask), city lights from a hand list of cities
(+ scattered suburbs and faint highways), soft clouds. Saved as texture.npy.
"""
import numpy as np
from global_land_mask import globe
from scipy import ndimage

TW, TH = 2048, 1024
rng = np.random.default_rng(7)

lat = 90 - (np.arange(TH) + 0.5) * 180 / TH
lon = -180 + (np.arange(TW) + 0.5) * 360 / TW
LON, LAT = np.meshgrid(lon, lat)
land = globe.is_land(LAT, LON).astype(np.float32)
land = ndimage.gaussian_filter(land, 0.7)

# (lat, lon, weight)
CITIES = [
    # India (dense, like the reference picture)
    (28.6, 77.2, 1.0), (19.1, 72.9, 1.0), (13.1, 80.3, .8), (22.6, 88.4, .9), (12.97, 77.6, .85),
    (17.4, 78.5, .8), (23.0, 72.6, .7), (18.5, 73.9, .7), (26.9, 75.8, .6), (26.8, 80.9, .65),
    (21.2, 72.8, .6), (25.6, 85.1, .6), (22.7, 75.9, .5), (21.1, 79.1, .5), (30.7, 76.8, .5),
    (31.6, 74.9, .45), (25.3, 83.0, .5), (27.2, 78.0, .45), (11.0, 76.96, .5), (9.9, 76.3, .45),
    (8.5, 76.9, .4), (20.3, 85.8, .45), (26.1, 91.7, .4), (23.3, 77.4, .45), (15.3, 75.1, .35),
    (16.5, 80.6, .4), (17.7, 83.3, .45), (24.6, 73.7, .35), (29.9, 78.2, .35), (32.7, 74.9, .35),
    (34.1, 74.8, .3), (12.3, 76.6, .35), (10.8, 78.7, .35), (14.4, 79.9, .3), (24.8, 93.9, .25),
    # South / Central Asia
    (24.9, 67.0, .8), (31.5, 74.3, .75), (33.7, 73.0, .5), (23.8, 90.4, .85), (27.7, 85.3, .4),
    (6.9, 79.9, .4), (41.3, 69.3, .45), (35.7, 51.4, .8), (32.7, 51.7, .45), (36.3, 59.6, .4),
    (34.5, 69.2, .35), (43.2, 76.9, .35), (39.6, 66.9, .25),
    # East Asia
    (31.2, 121.5, 1.0), (39.9, 116.4, 1.0), (23.1, 113.3, .95), (22.5, 114.1, .9), (30.6, 114.3, .7),
    (30.7, 104.1, .7), (29.6, 106.5, .65), (34.3, 108.9, .6), (32.1, 118.8, .6), (36.1, 120.4, .55),
    (39.1, 117.2, .6), (41.8, 123.4, .55), (45.8, 126.6, .45), (26.1, 119.3, .5), (25.0, 102.7, .4),
    (28.2, 113.0, .5), (36.7, 117.0, .5), (38.0, 114.5, .45), (34.7, 113.6, .55), (43.9, 125.3, .4),
    (35.7, 139.7, 1.0), (34.7, 135.5, .9), (35.2, 136.9, .7), (33.6, 130.4, .55), (43.1, 141.3, .4),
    (38.3, 140.9, .4), (37.6, 127.0, .95), (35.2, 129.1, .6), (25.0, 121.5, .7), (22.6, 120.3, .5),
    (39.0, 125.8, .15), (47.9, 106.9, .25),
    # Southeast Asia / Oceania
    (13.8, 100.5, .8), (21.0, 105.8, .6), (10.8, 106.7, .7), (14.6, 121.0, .8), (3.1, 101.7, .6),
    (1.35, 103.8, .7), (-6.2, 106.8, .9), (-7.3, 112.7, .6), (-6.9, 107.6, .55), (16.8, 96.2, .45),
    (11.6, 104.9, .3), (-33.9, 151.2, .7), (-37.8, 145.0, .65), (-27.5, 153.0, .45), (-31.95, 115.9, .4),
    (-34.9, 138.6, .35), (-36.8, 174.8, .35),
    # Middle East / Africa
    (25.2, 55.3, .7), (24.5, 54.4, .5), (24.7, 46.7, .65), (21.5, 39.2, .55), (29.4, 48.0, .5),
    (25.3, 51.5, .45), (33.3, 44.4, .55), (33.5, 36.3, .4), (31.9, 35.9, .35), (32.1, 34.8, .5),
    (41.0, 28.98, .85), (39.9, 32.9, .55), (38.4, 27.1, .45), (30.0, 31.2, .9), (31.2, 29.9, .55),
    (6.5, 3.4, .6), (9.1, 7.5, .35), (5.6, -0.2, .35), (14.7, -17.5, .3), (-1.3, 36.8, .4),
    (9.0, 38.7, .4), (-26.2, 28.0, .6), (-33.9, 18.4, .45), (-29.9, 31.0, .4), (-4.3, 15.3, .35),
    (33.6, -7.6, .5), (36.8, 3.1, .45), (36.8, 10.2, .35), (15.6, 32.5, .3), (-6.8, 39.3, .3),
    (-8.8, 13.2, .3),
    # Europe
    (51.5, -0.1, 1.0), (48.9, 2.35, 1.0), (52.5, 13.4, .8), (40.4, -3.7, .8), (41.9, 12.5, .7),
    (45.5, 9.2, .8), (52.4, 4.9, .7), (50.8, 4.4, .6), (48.2, 16.4, .6), (50.1, 14.4, .55),
    (52.2, 21.0, .6), (47.5, 19.0, .55), (44.4, 26.1, .5), (42.7, 23.3, .4), (37.98, 23.7, .5),
    (55.8, 37.6, 1.0), (59.9, 30.3, .7), (50.45, 30.5, .65), (53.9, 27.6, .45), (55.7, 12.6, .5),
    (59.3, 18.1, .5), (60.2, 24.9, .4), (59.9, 10.75, .4), (53.3, -6.3, .45), (55.9, -3.2, .4),
    (53.5, -2.2, .65), (52.5, -1.9, .6), (51.2, 6.8, .75), (50.1, 8.7, .6), (48.1, 11.6, .6),
    (53.55, 10.0, .55), (45.8, 4.8, .5), (43.3, 5.4, .5), (41.4, 2.2, .7), (38.7, -9.1, .5),
    (37.4, -6.0, .4), (39.5, -0.4, .45), (40.85, 14.3, .55), (45.1, 7.7, .5), (46.2, 6.1, .45),
    (47.4, 8.5, .5), (56.95, 24.1, .3), (54.7, 25.3, .3), (56.3, 44.0, .4), (55.0, 82.9, .4),
    (56.8, 60.6, .45), (55.2, 61.4, .35), (53.2, 50.2, .4), (48.7, 44.5, .4), (47.2, 39.7, .4),
    (45.0, 39.0, .3), (51.7, 39.2, .3), (54.3, 48.4, .3), (52.3, 104.3, .25), (43.1, 131.9, .25),
    # North America
    (40.7, -74.0, 1.0), (34.05, -118.2, 1.0), (41.9, -87.6, .9), (29.8, -95.4, .8), (33.4, -112.1, .6),
    (39.95, -75.2, .7), (32.8, -96.8, .8), (37.8, -122.4, .8), (47.6, -122.3, .6), (25.8, -80.2, .75),
    (33.75, -84.4, .7), (42.4, -71.1, .7), (38.9, -77.0, .7), (42.3, -83.0, .6), (44.98, -93.3, .5),
    (39.7, -105.0, .5), (32.7, -117.2, .55), (29.4, -98.5, .5), (35.2, -80.8, .45), (36.2, -86.8, .4),
    (39.1, -84.5, .4), (39.8, -86.2, .4), (40.4, -80.0, .4), (38.6, -90.2, .45), (39.1, -94.6, .4),
    (36.2, -115.1, .5), (45.5, -122.7, .45), (30.3, -97.7, .45), (28.5, -81.4, .45), (27.95, -82.5, .45),
    (43.65, -79.4, .75), (45.5, -73.6, .6), (49.3, -123.1, .5), (51.05, -114.1, .35), (53.5, -113.5, .3),
    (45.4, -75.7, .35), (19.4, -99.1, 1.0), (20.7, -103.3, .6), (25.7, -100.3, .6), (21.2, -86.8, .3),
    (19.0, -98.2, .45), (23.1, -82.4, .35), (18.5, -69.9, .35), (14.6, -90.5, .35), (9.0, -79.5, .3),
    # South America
    (-23.55, -46.6, 1.0), (-22.9, -43.2, .85), (-34.6, -58.4, .85), (-33.45, -70.7, .6), (-12.05, -77.0, .65),
    (4.7, -74.1, .65), (10.5, -66.9, .5), (-0.2, -78.5, .4), (-15.8, -47.9, .45), (-19.9, -43.9, .55),
    (-30.0, -51.2, .45), (-25.4, -49.3, .4), (-3.7, -38.5, .45), (-8.05, -34.9, .45), (-12.97, -38.5, .45),
    (-3.1, -60.0, .3), (6.25, -75.6, .45), (-31.4, -64.2, .4), (-34.9, -56.2, .35), (-16.5, -68.1, .3),
]


def splat(img, la, lo, sigma_px, amp):
    """Add a gaussian blob at (lat, lon) (wraps in longitude)."""
    y = (90 - la) / 180 * TH
    x = (lo + 180) / 360 * TW
    r = int(sigma_px * 3.5) + 2
    y0, y1 = max(0, int(y) - r), min(TH, int(y) + r + 1)
    for dx_shift in (0, -TW, TW):
        xs = np.arange(int(x) - r, int(x) + r + 1)
        xs_w = xs + dx_shift
        ok = (xs_w >= 0) & (xs_w < TW)
        if not ok.any():
            continue
        yy, xx = np.meshgrid(np.arange(y0, y1), xs[ok], indexing='ij')
        g = amp * np.exp(-(((xx - x) ** 2 + (yy - y) ** 2) / (2 * sigma_px ** 2)))
        img[y0:y1, xs_w[ok]] += g


lights = np.zeros((TH, TW), np.float32)
for la, lo, w in CITIES:
    splat(lights, la, lo, 1.2 + 2.2 * w, 1.6 * w)   # core
    splat(lights, la, lo, 4 + 6 * w, 0.22 * w)      # halo
    # suburbs / towns around the city
    n = int(18 + 60 * w)
    spread = 1.2 + 3.5 * w
    las = la + rng.normal(0, spread * 0.8, n)
    los = lo + rng.normal(0, spread / max(0.3, np.cos(np.radians(la))), n)
    for a, b in zip(las, los):
        b = ((b + 180) % 360) - 180
        a = float(np.clip(a, -89, 89))
        if globe.is_land(a, b):
            splat(lights, a, b, 0.7 + rng.random() * 0.8, 0.25 + rng.random() * 0.55)

# faint highways between nearby cities
for i, (a1, b1, w1) in enumerate(CITIES):
    for a2, b2, w2 in CITIES[i + 1:]:
        d = np.hypot(a1 - a2, (b1 - b2) * np.cos(np.radians((a1 + a2) / 2)))
        if 1.5 < d < 7.5 and rng.random() < 0.55:
            steps = int(d * 6)
            for k in range(steps):
                f = k / steps
                a = a1 + (a2 - a1) * f + rng.normal(0, 0.12)
                b = b1 + (b2 - b1) * f + rng.normal(0, 0.12)
                if globe.is_land(a, b) and rng.random() < 0.6:
                    splat(lights, a, b, 0.6, 0.18 * (w1 + w2))

lights *= land
lights = 1 - np.exp(-lights * 1.4)  # soft clip

# ---- base colours ----
def fbm(shape, octaves=5, seed=0):
    r = np.random.default_rng(seed)
    out = np.zeros(shape, np.float32)
    amp = 1.0
    for o in range(octaves):
        s = 2 ** (o + 2)
        small = r.random((shape[0] // (TH // s) + 2, shape[1] // (TW // (2 * s)) + 2)).astype(np.float32)
        z = ndimage.zoom(small, (shape[0] / small.shape[0] * 1.02, shape[1] / small.shape[1] * 1.02), order=3)
        out += amp * z[: shape[0], : shape[1]]
        amp *= 0.5
    out -= out.min()
    return out / out.max()

noise = fbm((TH, TW), 6, 3)
coast = np.clip(ndimage.gaussian_filter(land, 2.5) - ndimage.gaussian_filter(land, 0.6), -1, 1)
shelf = np.clip(ndimage.gaussian_filter(land, 6) * (1 - land) * 2.2, 0, 1)

ocean = np.array([6, 13, 40], np.float32) / 255
ocean_shelf = np.array([14, 34, 78], np.float32) / 255
land_c = np.array([15, 23, 50], np.float32) / 255
land_c2 = np.array([26, 35, 68], np.float32) / 255
ice = np.array([48, 60, 98], np.float32) / 255

polar = np.clip((np.abs(LAT) - 62) / 8, 0, 1)
greenland = ((LAT > 60) & (LON > -60) & (LON < -20)).astype(np.float32)
icy = np.clip(polar + greenland, 0, 1)[..., None]

n3 = noise[..., None]
base_ocean = ocean * (0.85 + 0.3 * n3) + (ocean_shelf - ocean) * shelf[..., None]
base_land = land_c + (land_c2 - land_c) * n3
base_land = base_land * (1 - icy) + ice * icy * (0.8 + 0.3 * n3)
L = land[..., None]
rgb = base_ocean * (1 - L) + base_land * L
# faint glowing coastline
rgb += np.array([40, 70, 140], np.float32)[None, None] / 255 * np.clip(np.abs(coast) * 3.0, 0, 1)[..., None] * 0.55

# city lights (warm orange with hot cores)
warm = np.array([255, 160, 60], np.float32) / 255
hot = np.array([255, 236, 190], np.float32) / 255
li = lights[..., None]
rgb = rgb + warm * li * 1.15 + hot * np.clip(li - 0.55, 0, 1) * 1.2

# clouds: thin, moonlit
cl = fbm((TH, TW), 6, 11)
cl = np.clip((cl - 0.55) * 3.0, 0, 1) ** 1.4
cl = ndimage.gaussian_filter(cl, 1.2)
cloud_c = np.array([150, 170, 220], np.float32) / 255
rgb = rgb * (1 - 0.35 * cl[..., None]) + cloud_c * 0.28 * cl[..., None]

rgb = np.clip(rgb, 0, 1)
np.save('texture.npy', rgb.astype(np.float32))
from PIL import Image
Image.fromarray((rgb * 255).astype(np.uint8)).save('texture_preview.jpg', quality=88)
print('ok', rgb.shape, lights.max())
