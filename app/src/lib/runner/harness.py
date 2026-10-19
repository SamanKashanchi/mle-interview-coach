# Runs one answer against test cases. Loaded once into Pyodide by python.worker.ts.
import copy, io, json, sys, time, traceback


def _norm(x):
    if isinstance(x, bool) or x is None or isinstance(x, (int, str)):
        return x
    if isinstance(x, float):
        return round(x, 6)
    if isinstance(x, dict):
        return {str(k): _norm(v) for k, v in x.items()}
    if isinstance(x, (set, frozenset)):
        return sorted((_norm(v) for v in x), key=lambda v: json.dumps(v, sort_keys=True))
    if isinstance(x, (list, tuple)):
        return [_norm(v) for v in x]
    if hasattr(x, "tolist"):  # numpy arrays, pandas series
        return _norm(x.tolist())
    if hasattr(x, "item"):  # numpy scalars
        return _norm(x.item())
    return repr(x)


def _sorted(x):
    return sorted(x, key=lambda v: json.dumps(v, sort_keys=True)) if isinstance(x, list) else x


def _show(x, limit=4000):
    s = repr(x)
    return s if len(s) <= limit else s[:limit] + " ..."


def _trace():
    # Keep only the answer's own frames.
    etype, value, tb = sys.exc_info()
    frames = [f for f in traceback.extract_tb(tb) if f.filename == "solution.py"]
    lines = ["Traceback (most recent call last):\n"] if frames else []
    lines += traceback.format_list(frames) + traceback.format_exception_only(etype, value)
    return "".join(lines).rstrip()


def _run_tests(src, payload):
    p = json.loads(payload)
    ns = {"__name__": "solution"}
    out = io.StringIO()
    sys.stdout = out
    try:
        exec(compile(src, "solution.py", "exec"), ns)
    except BaseException:
        return json.dumps({"compile_error": _trace()})
    finally:
        sys.stdout = sys.__stdout__
    fn = ns.get(p["entry"])
    if not callable(fn):
        return json.dumps({"compile_error": f"Define a function named {p['entry']}."})

    cases = []
    for t in p["tests"]:
        args = t.get("args", [])
        names = p["params"] if len(p["params"]) == len(args) else [f"arg{i + 1}" for i in range(len(args))]
        case = {
            "name": t["name"],
            "hidden": t["hidden"],
            "inputs": [{"label": n, "value": {"text": _show(a)}} for n, a in zip(names, args)],
            "expected": {"text": _show(t["expected"])},
            "output": None,
            "stdout": "",
            "error": None,
        }
        out = io.StringIO()
        sys.stdout = out
        start = time.perf_counter()
        try:
            got = fn(*copy.deepcopy(args))
            ordered = t.get("ordered", True)
            a, b = _norm(got), _norm(t["expected"])
            ok = a == b if ordered else _sorted(a) == _sorted(b)
            case["status"] = "pass" if ok else "fail"
            case["output"] = {"text": _show(got)}
        except BaseException:
            case["status"] = "error"
            case["error"] = _trace()
        finally:
            sys.stdout = sys.__stdout__
            case["ms"] = round((time.perf_counter() - start) * 1000)
            case["stdout"] = out.getvalue()[-4000:]
        cases.append(case)
    return json.dumps({"cases": cases})
