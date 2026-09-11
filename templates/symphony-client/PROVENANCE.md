# Provenance

This package is developed at `templates/symphony-client/` in
[`1000lines/symphony-example`](https://github.com/1000lines/symphony-example).
The package root maps to the future published template repository root;
`template/` alone maps to generated participant files.

CT-Q adds the question configuration, development documentation, tests, and CI.
The interface and layout follow the
[accepted plan at `873f511aea3e1d858e216d1a890ed1cd9a709d61`](https://github.com/1000lines/symphony-example/blob/873f511aea3e1d858e216d1a890ed1cd9a709d61/docs/symphony-plans/client-template/implementation-items.md#ct-q--define-and-test-the-seven-copier-answers)
and its linked design D4. Temporary test files are synthetic examples, not an
inventory or copy of the eventual client. CT-M/T record the actual client source
mapping, and CT-L gates the integrated release. No publication, installed host,
provider execution or live client operation is claimed here.

`LICENSE` is copied unchanged from the seed's Apache-2.0 license at that accepted
commit. The seed records its upstream extraction history in
[README.md](https://github.com/1000lines/symphony-example/blob/873f511aea3e1d858e216d1a890ed1cd9a709d61/README.md).
Retain source notices and record the reviewed source/destination commits when
the package is extracted. Copier and the Python dependencies retain their own
licenses; they are installed for tests, not copied into participant output.

Future publication uses a moving `alpha` branch selected by the operator's
`--vcs-ref=alpha`. Preserve ordinary `_src_path` and `_commit` in generated
answers, and record actual template/workflow/helper commits with each validation
run. A fixture commit proves only that fixture's rendering, not a public release
or every later `alpha` tip.
