# Python integrations

The Next.js /api/menu and /api/recommendations routes run the Python integrations in this folder. Install their dependencies in the same Python environment used by the Next.js server:

    python3 -m pip install -r app/api/requirements.txt

Set PYTHON_BIN if the interpreter is not named python3. The menu scraper retrieves published menus from M Dining. Recommendation text uses Ollama when the Python package, a running Ollama service, and the selected model are available; otherwise it uses the rule-based fallback. To enable the default model, install Ollama and run ollama pull llama3.2.

The current dashboard's waste and serving inputs remain illustrative demo estimates. The live menu is real, but it is not a source of measured waste.
