"""Pluggable object storage.

``fs`` (default, local): writes under ``storage_dir`` and serves via the
``/media`` static mount — zero infra. ``s3`` (prod): S3/MinIO via aioboto3.
Same interface either way.
"""

from pathlib import Path
from typing import Protocol

from app.config import Settings


class Storage(Protocol):
    async def ensure_ready(self) -> None: ...
    async def put(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> str: ...
    async def get(self, key: str) -> bytes: ...
    async def url(self, key: str) -> str: ...
    async def delete(self, key: str) -> None: ...


class FsStorage:
    def __init__(self, settings: Settings) -> None:
        self.root = Path(settings.storage_dir)
        self.base_url = settings.media_base_url.rstrip("/")

    async def ensure_ready(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        root = self.root.resolve()
        p = (self.root / key).resolve()
        if not str(p).startswith(str(root)):
            raise ValueError("path traversal blocked")
        return p

    async def put(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> str:
        p = self._path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)
        return await self.url(key)

    async def get(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    async def url(self, key: str) -> str:
        return f"{self.base_url}/{key}"

    async def delete(self, key: str) -> None:
        p = self._path(key)
        if p.exists():
            p.unlink()


class S3Storage:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.bucket = settings.s3_bucket

    def _client(self):  # noqa: ANN202
        import aioboto3

        session = aioboto3.Session()
        return session.client(
            "s3",
            endpoint_url=self.settings.s3_endpoint,
            region_name=self.settings.s3_region,
            aws_access_key_id=self.settings.s3_access_key,
            aws_secret_access_key=self.settings.s3_secret_key,
        )

    async def ensure_ready(self) -> None:
        async with self._client() as c:
            try:
                await c.head_bucket(Bucket=self.bucket)
            except Exception:
                await c.create_bucket(Bucket=self.bucket)

    async def put(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> str:
        async with self._client() as c:
            await c.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)
        return await self.url(key)

    async def get(self, key: str) -> bytes:
        async with self._client() as c:
            resp = await c.get_object(Bucket=self.bucket, Key=key)
            return await resp["Body"].read()

    async def url(self, key: str) -> str:
        async with self._client() as c:
            return await c.generate_presigned_url(
                "get_object", Params={"Bucket": self.bucket, "Key": key}, ExpiresIn=3600
            )

    async def delete(self, key: str) -> None:
        async with self._client() as c:
            await c.delete_object(Bucket=self.bucket, Key=key)


def get_storage(settings: Settings) -> Storage:
    if settings.storage_backend == "s3":
        return S3Storage(settings)
    return FsStorage(settings)
