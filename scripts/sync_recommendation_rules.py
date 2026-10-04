from pathlib import Path
import json, sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from recommender import RECOMMENDATIONS_DB
(ROOT / 'lib/recommendationRules.json').write_text(json.dumps(RECOMMENDATIONS_DB, indent=2) + '\n')
