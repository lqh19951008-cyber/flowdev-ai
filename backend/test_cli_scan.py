"""Automated tests for FlowDev-AI CLI Scanner and Pre-Commit Gatekeeper."""

import asyncio
from cli_scanner import CliScanner, CliFileItem


def test_cli_scanner_catches_critical_defects():
    """Verifies that unhandled null, eval(), or syntax errors are intercepted."""
    buggy_files = [
        CliFileItem(
            filename="src/pay.js",
            content=(
                "function pay(user, amount) {\n"
                "    const balance = user.wallet.balance;\n"
                "    if (user == null)\n"
                "        return null.amount;\n"
                "    return balance - amount;\n"
                "}\n"
            ),
        ),
        CliFileItem(
            filename="src/danger.py",
            content="def run_code(cmd):\n    return eval(cmd)\n",
        ),
    ]

    result = asyncio.run(CliScanner.scan_files(buggy_files))

    assert result.passed is False, "Expected buggy files to fail gatekeeper check"
    assert len(result.critical_issues) > 0, "Expected critical issues to be reported"
    assert any("null" in err for err in result.critical_issues), "Expected null dereference warning"
    assert any("eval" in err for err in result.critical_issues), "Expected eval() vulnerability warning"
    print(f"[OK] Buggy files intercepted successfully. Summary: {result.summary}")
    for idx, issue in enumerate(result.critical_issues, 1):
        print(f"     - Issue {idx}: {issue}")


def test_cli_scanner_passes_clean_code():
    """Verifies that clean and robust code passes the gatekeeper."""
    clean_files = [
        CliFileItem(
            filename="src/calculator.py",
            content=(
                "def add(a: int, b: int) -> int:\n"
                "    return a + b\n\n"
                "def multiply(a: int, b: int) -> int:\n"
                "    return a * b\n"
            ),
        )
    ]

    result = asyncio.run(CliScanner.scan_files(clean_files))

    assert result.passed is True, f"Expected clean code to pass, but got issues: {result.critical_issues}"
    assert len(result.critical_issues) == 0, "Expected zero critical issues"
    print(f"[OK] Clean code passed successfully. Summary: {result.summary}")


if __name__ == "__main__":
    print("Running CLI Scanner test suite...")
    test_cli_scanner_catches_critical_defects()
    test_cli_scanner_passes_clean_code()
    print("All CLI Scanner tests PASSED!")
