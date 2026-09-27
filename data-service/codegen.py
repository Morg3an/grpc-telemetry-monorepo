#!/usr/bin/env python3
"""
Protocol Buffer compiler script for Python Data Service.
Compiles proto/telemetry.proto into Python stubs in data-service/generated/
"""

import os
import sys
from pathlib import Path
from grpc_tools import protoc

def generate_protos():
    current_dir = Path(__file__).resolve().parent
    repo_root = current_dir.parent
    proto_dir = repo_root / "proto"
    proto_file = proto_dir / "telemetry.proto"
    output_dir = current_dir / "generated"

    if not proto_file.exists():
        print(f"Error: Proto file not found at {proto_file}")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)
    init_file = output_dir / "__init__.py"
    if not init_file.exists():
        init_file.write_text("# Auto-generated protobuf package\n")

    print(f"Compiling {proto_file} into {output_dir}...")

    protoc_args = [
        "protoc",
        f"-I{proto_dir}",
        f"--python_out={output_dir}",
        f"--grpc_python_out={output_dir}",
        str(proto_file),
    ]

    result = protoc.main(protoc_args)
    if result != 0:
        print(f"protoc failed with status code {result}")
        sys.exit(result)

    # Fix relative import in generated grpc stub for clean package/module imports
    grpc_stub = output_dir / "telemetry_pb2_grpc.py"
    if grpc_stub.exists():
        content = grpc_stub.read_text()
        # Handle both absolute and package-relative import cleanly
        fixed_content = content.replace(
            "import telemetry_pb2 as telemetry__pb2",
            "try:\n    from . import telemetry_pb2 as telemetry__pb2\nexcept (ImportError, ValueError):\n    import telemetry_pb2 as telemetry__pb2"
        )
        grpc_stub.write_text(fixed_content)

    print("Successfully generated Python gRPC stubs:")
    print(f" - {output_dir / 'telemetry_pb2.py'}")
    print(f" - {output_dir / 'telemetry_pb2_grpc.py'}")

if __name__ == "__main__":
    generate_protos()
