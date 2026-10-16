"""Run the research agent by hand for one company + role.

    python agents/research/research.py "Meta" "Machine Learning Engineer"

Needs ANTHROPIC_API_KEY in the environment. Writes the profile to
agents/research/out/<company>-<role>.json.

Two phases:
  1. Research: Claude searches and reads the web (server-side tools) and
     writes up its findings with source URLs.
  2. Structure: a second call with no tools turns those findings into JSON
     that matches schema.json, with topics limited to the topic list.
"""

import json
import re
import sys
from pathlib import Path

import anthropic

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
MODEL = "claude-opus-5-5"


def load_topics():
    # The topic list is kept in one place, the seed file for the topics table.
    sql = (ROOT / "supabase" / "seed_topics.sql").read_text(encoding="utf-8")
    return re.findall(r"^\('([^']+)','(\w+)'", sql, flags=re.M)


def research(client, company, role, topics):
    prompt = (HERE / "prompt.md").read_text(encoding="utf-8")
    topic_lines = "\n".join(f"- {name} ({category})" for name, category in topics)
    task = (
        f"Company: {company}\nRole: {role}\n\nTopic list:\n{topic_lines}\n\n"
        "Research this now. When you are done, write up your findings as plain text: "
        "the rounds in order, the topics per round with rough weights, style notes, "
        "level notes, confidence, gaps, and a numbered list of every source you used "
        "with its URL and title."
    )
    messages = [{"role": "user", "content": task}]
    tools = [
        {"type": "web_search_20260209", "name": "web_search", "max_uses": 15},
        {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": 15},
    ]
    for _ in range(10):
        with client.messages.stream(
            model=MODEL,
            max_tokens=32000,
            system=prompt,
            tools=tools,
            messages=messages,
            output_config={"effort": "high"},
        ) as stream:
            response = stream.get_final_message()
        searches = sum(1 for b in response.content if b.type == "server_tool_use")
        print(f"  ...{searches} searches/fetches this turn, stop: {response.stop_reason}")
        if response.stop_reason == "pause_turn":
            # Server-side tool loop hit its limit; send the turn back to continue.
            messages.append({"role": "assistant", "content": response.content})
            continue
        if response.stop_reason == "refusal":
            sys.exit("Claude declined this request.")
        return "".join(b.text for b in response.content if b.type == "text")
    sys.exit("Research did not finish after 10 continuations.")


def structure(client, company, role, findings, topics):
    schema = json.loads((HERE / "schema.json").read_text(encoding="utf-8"))
    topic_item = schema["properties"]["rounds"]["items"]["properties"]["topics"]["items"]
    topic_item["properties"]["topic"]["enum"] = [name for name, _ in topics]
    response = client.messages.create(
        model=MODEL,
        max_tokens=16000,
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": schema}},
        messages=[{
            "role": "user",
            "content": (
                f"Convert these research findings about {company} / {role} into the JSON format. "
                "Keep every fact; add nothing the findings don't support. "
                "Number sources from 1 and use those numbers in source_ids.\n\n" + findings
            ),
        }],
    )
    if response.stop_reason == "refusal":
        sys.exit("Claude declined to structure the findings.")
    return json.loads(next(b.text for b in response.content if b.type == "text"))


def main():
    if len(sys.argv) != 3:
        sys.exit('Usage: python agents/research/research.py "Company" "Role"')
    company, role = sys.argv[1], sys.argv[2]
    client = anthropic.Anthropic()
    topics = load_topics()

    print(f"Researching {company} / {role}...")
    findings = research(client, company, role, topics)
    print("Structuring...")
    profile = structure(client, company, role, findings, topics)

    out_dir = HERE / "out"
    out_dir.mkdir(exist_ok=True)
    slug = re.sub(r"[^a-z0-9]+", "-", f"{company}-{role}".lower()).strip("-")
    out = out_dir / f"{slug}.json"
    out.write_text(json.dumps(profile, indent=2), encoding="utf-8")
    (out_dir / f"{slug}-findings.md").write_text(findings, encoding="utf-8")

    print(f"\n{profile['summary']}\n")
    for i, r in enumerate(profile["rounds"], 1):
        top = ", ".join(t["topic"] for t in sorted(r["topics"], key=lambda t: -t["weight"])[:3])
        print(f"  {i}. {r['name']} ({r['type']}, x{r['count'] or '?'}): {top}")
    print(f"\nConfidence: {profile['confidence']}. Sources: {len(profile['sources'])}.")
    print(f"Saved to {out}")


if __name__ == "__main__":
    main()
