#!/usr/bin/env python3
import html
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

MONEYDJ_BASE = "https://mlivul.moneydj.com/w/wfv"
CODES = ["MSC00012", "MFD00022", "MFK00012", "MDI00012", "MSN00110"]
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "moneydj.json"


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.ignored_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.ignored_depth += 1
        if tag in {"br", "p", "div", "tr", "td", "th", "h1", "h2", "h3"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style"} and self.ignored_depth:
            self.ignored_depth -= 1
        if tag in {"p", "div", "tr", "td", "th", "h1", "h2", "h3"}:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.ignored_depth:
            self.parts.append(data)

    def text(self):
        raw = html.unescape("".join(self.parts)).replace("\xa0", " ")
        return "\n".join(line.strip() for line in raw.splitlines() if line.strip())


def html_to_text(document):
    parser = TextExtractor()
    parser.feed(document)
    return parser.text()


def parse_nav_text(text):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    code_index = next(index for index, line in enumerate(lines) if line.startswith("投資標的代碼"))
    name = re.sub(r"\(全權委託.*$", "", lines[code_index - 1]).strip()
    table_index = lines.index("近30日淨值")
    for index in range(table_index + 1, len(lines) - 1):
        if re.fullmatch(r"\d{4}/\d{2}/\d{2}", lines[index]) and re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", lines[index + 1]):
            return {"name": name, "dataDate": lines[index].replace("/", "-"), "nav": float(lines[index + 1])}
    raise ValueError("找不到MoneyDJ最新淨值")


def parse_distribution_text(text):
    compact = " ".join(line.strip() for line in text.splitlines() if line.strip())
    match = re.search(r"(\d{4}/\d{2}/\d{2})\s+([0-9]+(?:\.[0-9]+)?)\s+(USD|TWD)", compact)
    if not match:
        raise ValueError("找不到MoneyDJ最新撥回資料")
    return {"dividendDate": match.group(1).replace("/", "-"), "distribution": float(match.group(2)), "currency": match.group(3)}


def fetch_page(page, code):
    url = f"{MONEYDJ_BASE}/{page}.djhtm?a={urllib.parse.quote(code)}"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("big5", errors="replace")


def fetch_fund(code):
    nav = parse_nav_text(html_to_text(fetch_page("wfv02", code)))
    distribution = parse_distribution_text(html_to_text(fetch_page("wfv04", code)))
    return {"code": code, **nav, **distribution}


def main():
    funds = [fetch_fund(code) for code in CODES]
    payload = {"updatedAt": datetime.now(timezone.utc).isoformat(), "funds": funds}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"updated {len(funds)} MoneyDJ funds -> {OUTPUT}")


if __name__ == "__main__":
    main()
