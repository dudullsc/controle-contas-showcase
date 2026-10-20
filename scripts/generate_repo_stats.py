#!/usr/bin/env python3
"""Gera SVGs locais de stats e ranking deste repositório (funciona em repo privado)."""

from __future__ import annotations

import base64
import html
import json
import os
import re
import subprocess
import urllib.request
from collections import defaultdict
from pathlib import Path

OWNER = os.environ.get("OWNER", "dudullsc")
REPO = os.environ.get("REPO", "controle_contas")
OUT = Path("profile")
OUT.mkdir(exist_ok=True)


def run(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, text=True).strip()


def gh_json(path: str):
    return json.loads(run(["gh", "api", path]))


def normalize_author(name: str, email: str) -> str:
    email = email.lower().strip()
    m = re.match(r"^(\d+)\+([^@]+)@users\.noreply\.github\.com$", email)
    if m:
        return m.group(2)
    m = re.match(r"^([^@]+)@users\.noreply\.github\.com$", email)
    if m:
        return m.group(1)
    # Prefer GitHub login-like names already in commits
    if name.strip().lower() in {"dudullsc"}:
        return "dudullsc"
    if "eduardo" in name.lower() and "lopes" in name.lower():
        return "dudullsc"
    if email.startswith("eduardotecnologia"):
        return "dudullsc"
    return name.strip() or email


def is_bot(login: str) -> bool:
    lower = login.lower()
    return (
        "[bot]" in lower
        or lower.endswith("-bot")
        or lower in {"github-actions", "dependabot", "renovate"}
    )


def collect_commit_counts() -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    log = run(["git", "log", "--format=%aN|%aE"])
    for line in log.splitlines():
        if "|" not in line:
            continue
        name, email = line.split("|", 1)
        author = normalize_author(name, email)
        if is_bot(author) or is_bot(name):
            continue
        counts[author] += 1
    return dict(counts)


def collect_pr_issue_counts() -> tuple[dict[str, int], dict[str, int]]:
    prs: dict[str, int] = defaultdict(int)
    issues: dict[str, int] = defaultdict(int)
    try:
        pr_logins = run(
            [
                "gh",
                "api",
                "--paginate",
                f"repos/{OWNER}/{REPO}/pulls?state=all&per_page=100",
                "--jq",
                ".[].user.login",
            ]
        ).splitlines()
        for login in pr_logins:
            if login and not is_bot(login):
                prs[login] += 1
    except Exception:
        pass

    try:
        issue_logins = run(
            [
                "gh",
                "api",
                "--paginate",
                f"repos/{OWNER}/{REPO}/issues?state=all&per_page=100",
                "--jq",
                ".[] | select(.pull_request | not) | .user.login",
            ]
        ).splitlines()
        for login in issue_logins:
            if login and not is_bot(login):
                issues[login] += 1
    except Exception:
        pass

    return dict(prs), dict(issues)


def fetch_avatar_data_uri(login: str) -> str:
    try:
        user = gh_json(f"users/{login}")
        url = user.get("avatar_url", "") + "&s=64"
        with urllib.request.urlopen(url, timeout=20) as resp:
            data = resp.read()
            ctype = resp.headers.get_content_type() or "image/png"
        b64 = base64.b64encode(data).decode("ascii")
        return f"data:{ctype};base64,{b64}"
    except Exception:
        # fallback circle color
        return ""


def medal(rank: int) -> str:
    return {1: "#f1e05a", 2: "#c0c0c0", 3: "#cd7f32"}.get(rank, "#8b949e")


def generate_rank_svg(
    commits: dict[str, int], prs: dict[str, int], issues: dict[str, int]
) -> str:
    users = set(commits) | set(prs) | set(issues)
    rows_data = []
    for u in users:
        c, p, i = commits.get(u, 0), prs.get(u, 0), issues.get(u, 0)
        score = c * 1 + p * 3 + i * 2  # peso: PR > issue > commit
        rows_data.append((score, c, p, i, u))
    rows_data.sort(key=lambda x: (-x[0], -x[1], x[4].lower()))

    row_h = 56
    header_h = 100
    height = header_h + max(1, len(rows_data)) * row_h + 36
    width = 620

    body = []
    y = header_h
    for idx, (score, c, p, i, login) in enumerate(rows_data, start=1):
        avatar = fetch_avatar_data_uri(login)
        medal_color = medal(idx)
        if avatar:
            avatar_el = f'<image href="{avatar}" x="56" y="{y + 10}" width="36" height="36" clip-path="url(#avatarClip{idx})"/>'
            clip = f'<clipPath id="avatarClip{idx}"><circle cx="74" cy="{y + 28}" r="18"/></clipPath>'
        else:
            avatar_el = f'<circle cx="74" cy="{y + 28}" r="18" fill="#21262d"/><text x="74" y="{y + 33}" text-anchor="middle" class="medal">{html.escape(login[:1].upper())}</text>'
            clip = ""

        body.append(
            f"""
  {clip}
  <rect x="16" y="{y}" width="{width - 32}" height="{row_h - 8}" rx="10" fill="#161b22" stroke="#30363d"/>
  <circle cx="36" cy="{y + 28}" r="12" fill="{medal_color}"/>
  <text x="36" y="{y + 33}" text-anchor="middle" class="rank">{idx}</text>
  {avatar_el}
  <a href="https://github.com/{html.escape(login)}">
    <text x="106" y="{y + 24}" class="name">{html.escape(login)}</text>
  </a>
  <text x="106" y="{y + 42}" class="muted">score {score}</text>
  <text x="300" y="{y + 33}" class="stat"><tspan class="num">{c}</tspan> commits</text>
  <text x="420" y="{y + 33}" class="stat"><tspan class="num">{p}</tspan> PRs</text>
  <text x="510" y="{y + 33}" class="stat"><tspan class="num">{i}</tspan> issues</text>
"""
        )
        y += row_h

    if not rows_data:
        body.append(
            f'<text x="24" y="{header_h + 30}" class="muted">Nenhum contribuidor encontrado.</text>'
        )

    return f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <style>
    .title {{ font: 700 18px 'Segoe UI', Ubuntu, sans-serif; fill: #c9d1d9; }}
    .subtitle {{ font: 400 12px 'Segoe UI', Ubuntu, sans-serif; fill: #8b949e; }}
    .name {{ font: 600 15px 'Segoe UI', Ubuntu, sans-serif; fill: #58a6ff; }}
    .muted {{ font: 400 12px 'Segoe UI', Ubuntu, sans-serif; fill: #8b949e; }}
    .stat {{ font: 500 13px 'Segoe UI', Ubuntu, sans-serif; fill: #c9d1d9; }}
    .num {{ font: 700 13px 'Segoe UI', Ubuntu, sans-serif; fill: #3fb950; }}
    .rank {{ font: 700 12px 'Segoe UI', Ubuntu, sans-serif; fill: #0d1117; }}
    .medal {{ font: 700 14px 'Segoe UI', Ubuntu, sans-serif; fill: #c9d1d9; }}
  </style>
  <rect width="{width}" height="{height}" rx="12" fill="#0d1117" stroke="#30363d"/>
  <text x="24" y="36" class="title">Ranking de contribuidores — {html.escape(REPO)}</text>
  <text x="24" y="58" class="subtitle">Ordenado por score (commit ×1 + PR ×3 + issue ×2) · só deste repositório</text>
  <text x="300" y="82" class="subtitle">Commits</text>
  <text x="420" y="82" class="subtitle">PRs</text>
  <text x="510" y="82" class="subtitle">Issues</text>
  {''.join(body)}
</svg>
'''


def generate_stats_svg() -> str:
    repo = gh_json(f"repos/{OWNER}/{REPO}")
    langs = gh_json(f"repos/{OWNER}/{REPO}/languages")
    commits = sum(collect_commit_counts().values())
    prs = int(
        run(
            [
                "gh",
                "api",
                f"search/issues?q=repo:{OWNER}/{REPO}+is:pr",
                "--jq",
                ".total_count",
            ]
        )
        or "0"
    )
    issues = int(
        run(
            [
                "gh",
                "api",
                f"search/issues?q=repo:{OWNER}/{REPO}+is:issue",
                "--jq",
                ".total_count",
            ]
        )
        or "0"
    )
    stars = repo.get("stargazers_count", 0)
    forks = repo.get("forks_count", 0)
    contribs = len(gh_json(f"repos/{OWNER}/{REPO}/contributors"))

    total = sum(langs.values()) or 1
    colors = {
        "TypeScript": "#3178c6",
        "Python": "#3572A5",
        "JavaScript": "#f1e05a",
        "CSS": "#563d7c",
        "Dockerfile": "#384d54",
        "HTML": "#e34c26",
        "Shell": "#89e051",
    }
    items = sorted(langs.items(), key=lambda x: -x[1])[:5]
    rows, y = [], 145
    for name, bytes_ in items:
        pct = bytes_ / total * 100
        color = colors.get(name, "#8b949e")
        bar_w = max(4, int(pct * 2.2))
        rows.append(
            f'''
  <circle cx="36" cy="{y}" r="5" fill="{color}"/>
  <text x="48" y="{y+4}" class="label">{html.escape(name)}</text>
  <text x="160" y="{y+4}" class="muted">{pct:.1f}%</text>
  <rect x="210" y="{y-6}" width="220" height="10" rx="5" fill="#21262d"/>
  <rect x="210" y="{y-6}" width="{bar_w}" height="10" rx="5" fill="{color}"/>'''
        )
        y += 24
    height = max(280, y + 20)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="460" height="{height}" viewBox="0 0 460 {height}">
  <style>
    .title {{ font: 600 16px 'Segoe UI', Ubuntu, sans-serif; fill: #c9d1d9; }}
    .value {{ font: 700 22px 'Segoe UI', Ubuntu, sans-serif; fill: #58a6ff; }}
    .label {{ font: 600 13px 'Segoe UI', Ubuntu, sans-serif; fill: #c9d1d9; }}
    .muted {{ font: 400 12px 'Segoe UI', Ubuntu, sans-serif; fill: #8b949e; }}
    .section {{ font: 600 14px 'Segoe UI', Ubuntu, sans-serif; fill: #8b949e; }}
  </style>
  <rect width="460" height="{height}" rx="12" fill="#0d1117" stroke="#30363d"/>
  <text x="24" y="36" class="title">{html.escape(REPO)} — estatísticas do repositório</text>
  <text x="36" y="78" class="value">{commits}</text>
  <text x="36" y="98" class="muted">Commits</text>
  <text x="140" y="78" class="value">{prs}</text>
  <text x="140" y="98" class="muted">PRs</text>
  <text x="220" y="78" class="value">{issues}</text>
  <text x="220" y="98" class="muted">Issues</text>
  <text x="300" y="78" class="value">{stars}</text>
  <text x="300" y="98" class="muted">Stars</text>
  <text x="380" y="78" class="value">{forks}</text>
  <text x="380" y="98" class="muted">Forks</text>
  <text x="24" y="128" class="section">Linguagens neste repositório</text>
  {''.join(rows)}
  <text x="24" y="{height - 16}" class="muted">{contribs} contributor(s)</text>
</svg>
'''


def generate_badges_svg(commits: int, prs: int, issues: int, stars: int, forks: int) -> str:
    badges = [
        ("Commits", commits, "#238636", f"https://github.com/{OWNER}/{REPO}/commits"),
        ("PRs", prs, "#1f6feb", f"https://github.com/{OWNER}/{REPO}/pulls"),
        ("Issues", issues, "#da3633", f"https://github.com/{OWNER}/{REPO}/issues"),
        ("Stars", stars, "#e3b341", f"https://github.com/{OWNER}/{REPO}/stargazers"),
        ("Forks", forks, "#8b949e", f"https://github.com/{OWNER}/{REPO}/network/members"),
    ]
    parts = []
    x = 8
    for label, value, color, href in badges:
        text = f"{label}: {value}"
        w = 24 + len(text) * 8
        parts.append(
            f'''
  <a href="{href}">
    <rect x="{x}" y="8" width="{w}" height="28" rx="6" fill="{color}"/>
    <text x="{x + w/2}" y="27" text-anchor="middle" class="badge">{html.escape(text)}</text>
  </a>'''
        )
        x += w + 10
    width = x + 8
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="44" viewBox="0 0 {width} 44">
  <style>
    .badge {{ font: 700 12px 'Segoe UI', Ubuntu, sans-serif; fill: #ffffff; }}
  </style>
  <rect width="{width}" height="44" fill="transparent"/>
  {''.join(parts)}
</svg>
'''


def generate_pin_svg() -> str:
    repo = gh_json(f"repos/{OWNER}/{REPO}")
    desc = (repo.get("description") or "Repositório privado")[:90]
    lang = repo.get("language") or "—"
    stars = repo.get("stargazers_count", 0)
    forks = repo.get("forks_count", 0)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120" viewBox="0 0 400 120">
  <style>
    .title {{ font: 700 16px 'Segoe UI', Ubuntu, sans-serif; fill: #58a6ff; }}
    .desc {{ font: 400 12px 'Segoe UI', Ubuntu, sans-serif; fill: #8b949e; }}
    .meta {{ font: 500 12px 'Segoe UI', Ubuntu, sans-serif; fill: #c9d1d9; }}
  </style>
  <rect width="400" height="120" rx="12" fill="#0d1117" stroke="#30363d"/>
  <text x="20" y="36" class="title">{html.escape(OWNER)}/{html.escape(REPO)}</text>
  <text x="20" y="60" class="desc">{html.escape(desc)}</text>
  <circle cx="28" cy="92" r="5" fill="#3178c6"/>
  <text x="40" y="96" class="meta">{html.escape(lang)}</text>
  <text x="140" y="96" class="meta">★ {stars}</text>
  <text x="210" y="96" class="meta">⑂ {forks}</text>
  <text x="280" y="96" class="meta">private</text>
</svg>
'''


def main() -> None:
    commits = collect_commit_counts()
    prs, issues = collect_pr_issue_counts()

    (OUT / "contributor-rank.svg").write_text(
        generate_rank_svg(commits, prs, issues), encoding="utf-8"
    )
    (OUT / "repo-stats.svg").write_text(generate_stats_svg(), encoding="utf-8")
    (OUT / "repo-pin.svg").write_text(generate_pin_svg(), encoding="utf-8")

    total_commits = sum(commits.values())
    total_prs = sum(prs.values())
    total_issues = sum(issues.values())
    repo = gh_json(f"repos/{OWNER}/{REPO}")
    (OUT / "repo-badges.svg").write_text(
        generate_badges_svg(
            total_commits,
            total_prs,
            total_issues,
            repo.get("stargazers_count", 0),
            repo.get("forks_count", 0),
        ),
        encoding="utf-8",
    )
    print("Generated:", ", ".join(p.name for p in OUT.glob("*.svg")))
    print("Rank:", sorted(commits.items(), key=lambda x: -x[1]))


if __name__ == "__main__":
    main()
