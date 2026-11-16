import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'web/public'


def test_manifest_verifies_published_statistical_kernel_and_python_assets():
    manifest = json.loads((PUBLIC / 'manifest.json').read_text())
    for name, metadata in manifest['files'].items():
        data = (PUBLIC / name).read_bytes()
        assert len(data) == metadata['bytes']
        assert hashlib.sha256(data).hexdigest() == metadata['sha256']
    assert (PUBLIC / 'engine.R').read_bytes() == (ROOT / 'research-pipeline/engine.R').read_bytes()


def test_plotly_contract_contains_visuals_and_explicit_bindings():
    figures = json.loads((PUBLIC / 'figures.json').read_text())
    bindings = json.loads((PUBLIC / 'bindings.json').read_text())
    assert [trace['name'] for trace in figures['posterior']['data']] == ['Credible interval', 'Prior', 'Posterior']
    assert figures['posterior']['data'][1]['line']['dash'] == 'dash'
    assert bindings['posterior']['data.2.y'] == 'curve.y'
    assert set(figures['markers']) == {'truth', 'mean', 'median', 'mode'}
