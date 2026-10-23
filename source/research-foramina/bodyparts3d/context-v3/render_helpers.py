import numpy as np
from matplotlib.collections import PolyCollection
from matplotlib.colors import to_rgb

def color(s):
    n = s['en'].lower()
    if 'sulcus' in n:
        return '#9a7adc'
    if 'transverse temporal gyrus' in n:
        return '#e78e32'
    if 'insula' in n or s['id'].startswith(('MM3814', 'MM3815', 'MM3819', 'MM3820', 'MM3821', 'MM3822')):
        return '#db6174'
    if 'frontal' in n or 'orbital' in n or 'straight' in n or ('precentral' in n):
        return '#7cafd4'
    if 'temporal' in n or 'fusiform' in n or 'parahippocamp' in n:
        return '#7cbdac'
    if 'occipital' in n or n.endswith('cuneus') or 'lingual' in n:
        return '#ac9cc6'
    if 'cingulate' in n:
        return '#b7a88e'
    return '#d4b774'

def panel(ax, objects, view, title):
    R = {'left': np.array([[0, -1, 0], [0, 0, 1], [1, 0, 0]]), 'front': np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]]), 'top': np.array([[1, 0, 0], [0, -1, 0], [0, 0, 1]])}[view]
    faces = []
    depth = []
    colors = []
    for s in objects:
        tv = s['v'][s['f']]
        norm = np.cross(tv[:, 1] - tv[:, 0], tv[:, 2] - tv[:, 0])
        norm /= np.maximum(np.linalg.norm(norm, axis=1)[:, None], 1e-09)
        light = 0.56 + 0.44 * np.maximum(0, norm @ np.array([0.45, -0.45, 0.77]))
        colors.append(np.clip(np.array(to_rgb(color(s)))[None, :] * light[:, None], 0, 1))
        transformed = tv @ R.T
        faces.append(transformed[:, :, :2])
        depth.append(transformed[:, :, 2].mean(1))
    polys = np.concatenate(faces)
    colors = np.concatenate(colors)
    order = np.argsort(np.concatenate(depth))
    ax.add_collection(PolyCollection(polys[order], facecolors=colors[order], linewidth=0, antialiased=False, rasterized=True))
    lo = polys.reshape(-1, 2).min(0)
    hi = polys.reshape(-1, 2).max(0)
    pad = (hi - lo) * 0.05
    ax.set_xlim(lo[0] - pad[0], hi[0] + pad[0])
    ax.set_ylim(lo[1] - pad[1], hi[1] + pad[1])
    ax.set_aspect('equal')
    ax.axis('off')
    ax.set_title(title, fontsize=11)