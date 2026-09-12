FROM rust@sha256:7fa728f3678acf5980d5db70960cf8491aff9411976789086676bdf0c19db39e

RUN rustup component add --toolchain 1.90.0 clippy rustfmt
# Preserve the image's /usr/local/rustup installation under an arbitrary UID.
ENV RUSTUP_TOOLCHAIN=1.90.0
