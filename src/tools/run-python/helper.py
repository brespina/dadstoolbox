# The helper the worker runs once, when Python has loaded. It is Python, so it is tested
# under Node by helper.test.ts. The worker calls `run_program(source)` for each Run; it
# returns what the Run ended with: "ok", "error", "missingModule" or "stopped".
#
# It compiles the Program as "main.py", runs it in a namespace of its own, and catches the
# error itself. Calling this directly (not through Pyodide's runPythonAsync) is what keeps
# the page's own frames, and Pyodide's hint about installing packages, out of what the
# visitor reads.
import linecache
import sys
import traceback


def run_program(source):
    # Without this, a traceback shows the file and line but not the line of code.
    linecache.cache["main.py"] = (len(source), None, source.splitlines(True), "main.py")
    namespace = {"__name__": "__main__"}
    try:
        exec(compile(source, "main.py", "exec"), namespace)
        return "ok"
    except SystemExit as exit:
        # sys.exit() ends a Program quietly. Python prints a message given as text.
        if exit.code is None or exit.code == 0:
            return "ok"
        if not isinstance(exit.code, int):
            print(exit.code, file=sys.stderr)
        return "error"
    except KeyboardInterrupt:
        # Stop (ADR-0009): the page says "Stopped." in place of a traceback.
        return "stopped"
    except BaseException as error:
        missing = isinstance(error, ModuleNotFoundError)
        if missing:
            # Python's own words, and none about how to install a package here.
            error.__notes__ = []
            if error.name:
                error.msg = "No module named " + repr(error.name)
                error.args = (error.msg,)
        # Start at the Program: cut the frames of this helper.
        trace = error.__traceback__
        while trace is not None and trace.tb_frame.f_code.co_filename != "main.py":
            trace = trace.tb_next
        traceback.print_exception(type(error), error, trace, file=sys.stderr)
        # A part of Python's own library the browser can't have (turtle, tkinter, curses)
        # would make the plain line untrue, so Python's message stands alone.
        if missing and (error.name or "").split(".")[0] in sys.stdlib_module_names:
            return "error"
        return "missingModule" if missing else "error"
    finally:
        # Python holds back a line with no newline yet: send it now, so it is part of this
        # Run, and not shown after "Done." or in the next Run.
        sys.stdout.flush()
        sys.stderr.flush()
        linecache.cache.pop("main.py", None)
