# Lokaler Betrieb des Chatbots

## Datenhaltung

Die Wissensbasis liegt lokal als Markdown-Dateien im Ordner data/knowledge. Feedback wird lokal im Ordner data/runtime gespeichert. Chatverlaeufe werden standardmaessig nicht gespeichert. Wenn LOG_CHAT_TRANSCRIPTS=true gesetzt wird, schreibt der Server Fragen und Antworten lokal in eine JSONL-Datei.
Die oeffentliche Repository-Version enthaelt nur eine kleine, selbst formulierte Beispiel-Wissensbasis. Sie enthaelt keine Kopie der Mensa-Website, keine internen Seiten und keine Kontaktverzeichnisse.

## Modellbetrieb

Der Prototyp funktioniert ohne externes KI-Modell durch lokale Stichwortsuche und extraktive Antworten aus der Wissensbasis. Optional kann ein lokales Ollama-Modell verwendet werden. Dann sendet der Server die Frage und relevante Quellen nur an http://127.0.0.1:11434 oder die konfigurierte lokale Ollama-Adresse.

## Produktive Anforderungen

Vor einem Einsatz mit echten Mitgliedern braucht der Bot freigegebene Inhalte, ein Berechtigungskonzept fuer die Pflege der Wissensbasis, klare Kontaktwege fuer Eskalationen, ein Datenschutzkonzept und eine Entscheidung zur Protokollierung. Externe Analytics, externe LLM-APIs und fremde CDNs sollten fuer diese lokale Datenschutzvariante vermieden werden.
