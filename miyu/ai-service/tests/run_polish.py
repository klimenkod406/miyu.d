"""Полировочный скрипт: запускает все треки с ground truth, собирает метрики."""
import sys, os, json, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ['MIYU_AI_WHISPER_MODEL'] = 'C:/Users/Денис/Desktop/miyu.d/miyu/ai-service/whisper_model'

from tests.test_benchmark import run_benchmark, compute_wer, normalize_text

# Треки для тестирования (id, config, lang, name)
TEST_TRACKS = [
    (34, "music_polish", None, "HammAli & Navai - Пустите меня на танцпол"),
    (36, "music_polish", "ru", "JONY - Комета"),
    (52, "music_polish", "ru", "Баста - Сансара"),
    (110, "music_polish", "ru", "Дора - Втюрилась"),
]

def analyze_errors(result):
    """Подробный анализ ошибок."""
    if not result.metrics or not result.transcription:
        return []
    
    m = result.metrics
    ref = normalize_text(result.expected_text)
    hyp = normalize_text(result.transcription.get("text", ""))
    
    ref_tokens = ref.split()
    hyp_tokens = hyp.split()
    
    errors = []
    
    # DP alignment to find substitutions
    n, m_len = len(ref_tokens), len(hyp_tokens)
    d = [[0] * (m_len + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        d[i][0] = i
    for j in range(m_len + 1):
        d[0][j] = j
    
    for i in range(1, n + 1):
        for j in range(1, m_len + 1):
            cost = 0 if ref_tokens[i - 1] == hyp_tokens[j - 1] else 1
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    
    # Backtrace
    i, j = n, m_len
    while i > 0 or j > 0:
        if i > 0 and j > 0 and d[i][j] == d[i - 1][j - 1] + (0 if ref_tokens[i - 1] == hyp_tokens[j - 1] else 1):
            if ref_tokens[i - 1] != hyp_tokens[j - 1]:
                errors.append(("substitution", ref_tokens[i - 1], hyp_tokens[j - 1]))
            i -= 1
            j -= 1
        elif i > 0 and d[i][j] == d[i - 1][j] + 1:
            errors.append(("deletion", ref_tokens[i - 1], ""))
            i -= 1
        elif j > 0 and d[i][j] == d[i][j - 1] + 1:
            errors.append(("insertion", "", hyp_tokens[j - 1]))
            j -= 1
        else:
            if i > 0:
                errors.append(("deletion", ref_tokens[i - 1], ""))
                i -= 1
            if j > 0:
                errors.append(("insertion", "", hyp_tokens[j - 1]))
                j -= 1
    
    return errors

all_substitutions = {}

print("=" * 70)
print("BATCH POLISH RUN - music_polish config")
print("=" * 70)

results = []
for track_id, config, lang, name in TEST_TRACKS:
    print(f"\n>>> {name} (track {track_id})")
    t0 = time.time()
    try:
        result = run_benchmark(track_id, config, language=lang)
        elapsed = time.time() - t0
        
        if result.metrics:
            m = result.metrics
            acc = (1 - m['wer']) * 100
            print(f"  Accuracy: {acc:.1f}%")
            print(f"  WER: {m['wer']*100:.1f}% | Recall: {m['recall']*100:.1f}% | F1: {m['f1']*100:.1f}%")
            print(f"  Subs: {m['substitutions']} | Ins: {m['insertions']} | Del: {m['deletions']}")
            print(f"  Time: {elapsed:.0f}s")
            
            errors = analyze_errors(result)
            
            # Count substitution patterns
            for err_type, ref, hyp in errors:
                if err_type == "substitution":
                    key = f"{ref} -> {hyp}"
                    all_substitutions[key] = all_substitutions.get(key, 0) + 1
            
            results.append(result)
        else:
            print(f"  FAILED: {result.error}")
    except Exception as e:
        print(f"  ERROR: {e}")

# Summary
print(f"\n{'=' * 70}")
print("SUMMARY")
print(f"{'=' * 70}")
print(f"{'Track':35s} | {'Acc%':6s} | {'Recall%':7s} | {'F1%':6s} | {'Subs':5s} | {'Time':6s}")
print(f"{'-' * 35}+{'-'*8}+{'-'*9}+{'-'*8}+{'-'*7}+{'-'*8}")
for r in results:
    if r.metrics:
        m = r.metrics
        name = r.track_name[:34]
        print(f"{name:35s} | {(1-m['wer'])*100:5.1f}% | {m['recall']*100:6.1f}% | {m['f1']*100:5.1f}% | {m['substitutions']:5d} | {'-':6s}")

# Common substitution patterns
print(f"\n{'=' * 70}")
print("COMMON SUBSTITUTION PATTERNS (across all tracks)")
print(f"{'=' * 70}")
sorted_subs = sorted(all_substitutions.items(), key=lambda x: -x[1])
for pattern, count in sorted_subs[:30]:
    print(f"  [{count}] {pattern}")

print(f"\nTotal unique substitution patterns: {len(sorted_subs)}")
print("Done!")
