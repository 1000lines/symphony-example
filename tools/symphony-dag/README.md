# symphony-dag

`symphony-dag` parses reviewed Symphony DAG plans and emits deterministic
Linear fan-out payloads. It intentionally contains no git branch mutation,
transaction, recovery, remote-sync, or command-line workflow surface.

Build and test the package:

```bash
npm run symphony-dag:check
```
