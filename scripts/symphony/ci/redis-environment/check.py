"""Assert every required endpoint, using only the pinned environment's client."""

import json
import os
from pathlib import Path
import time
import urllib.request

import redis

root = Path("/work/source/dockers")
deadline = time.monotonic() + 120
while True:
    try:
        versions = {}
        for port in [6379, 6380, 6479, 3000, 15379, 15380, 15381, *range(16379, 16391)]:
            client = redis.Redis(host="127.0.0.1", port=port, socket_timeout=3)
            assert client.ping(), port
            versions[str(port)] = client.info("server")["redis_version"]
        for port, directory in [(6666, "standalone"), *[(27379+i, "cluster" if i < 6 else "cluster2") for i in range(12)]]:
            client = redis.Redis(host="localhost", port=port, ssl=True,
                                 ssl_ca_certs=str(root / directory / "tls/ca.crt"), socket_timeout=3)
            assert client.ping(), port
        replica = redis.Redis(port=6380, socket_timeout=3).info("replication")
        assert replica["role"] == "slave" and replica["master_link_status"] == "up"
        assert replica["master_host"] == "127.0.0.1" and replica["master_port"] == 6379
        for port in [26379, 26380, 26381]:
            client = redis.Redis(port=port, decode_responses=True, socket_timeout=3)
            assert client.sentinel_get_master_addr_by_name("redis-py-test") == ("127.0.0.1", 6379), f"sentinel {port} master address"
        clusters = {}
        for port in [16379, 16385]:
            client = redis.Redis(port=port, decode_responses=True, socket_timeout=3)
            info = client.cluster("info")
            assert info["cluster_state"] == "ok" and int(info["cluster_slots_assigned"]) == 16384
            nodes = client.cluster("nodes")
            assert len(nodes) == 6 and all(address.startswith("127.0.0.1:") for address in nodes)
            clusters[str(port)] = nodes
        modules = redis.Redis(port=6479, decode_responses=True, socket_timeout=3).module_list()
        names = {module["name"].lower() for module in modules}
        assert {"search", "rejson", "timeseries", "bf"} <= names, names
        with urllib.request.urlopen("http://127.0.0.1:4000/stats", timeout=3) as response:
            assert response.status == 200
            proxy = json.load(response)
        print(json.dumps({"uid": os.getuid(), "gid": os.getgid(), "versions": versions,
                          "clusters": clusters, "modules": modules, "proxy": proxy}))
        break
    except (AssertionError, redis.RedisError, OSError) as error:
        if time.monotonic() >= deadline:
            raise
        print(f"Waiting for topology: {error}", flush=True)
        time.sleep(2)
