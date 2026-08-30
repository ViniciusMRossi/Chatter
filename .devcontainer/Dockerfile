FROM mcr.microsoft.com/devcontainers/base@sha256:c5cc2b45afe06a1df3aba17e58ba0dc4a02b999493198dab37dd0ccd4e2b0705

ARG SDD_HOST_UID=1000
ARG SDD_HOST_GID=1000

# The uid/gid remap logic assumes the pinned base image exposes the built-in
# vscode user at 1000:1000. Fail at image build if that invariant changes.
USER root
RUN test "$(id -u vscode)" = "1000" && test "$(id -g vscode)" = "1000" \
    || { echo "Pinned base image no longer exposes vscode at 1000:1000; review the digest pin and the uid remap logic." >&2; exit 1; }
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git jq python3 python3-pip python3-venv unzip \
    && mkdir -p -m 755 /etc/apt/keyrings \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Remap the built-in vscode user to the host uid/gid so bind-mounted project files
# remain editable on Linux while still retaining a real passwd/group entry.
RUN set -eux; \
    current_uid="$(id -u vscode)"; \
    current_gid="$(id -g vscode)"; \
    target_group="vscode"; \
    if [ "$SDD_HOST_GID" != "$current_gid" ]; then \
      existing_group="$(getent group "$SDD_HOST_GID" | cut -d: -f1 || true)"; \
      if [ -n "$existing_group" ]; then \
        target_group="$existing_group"; \
      else \
        groupmod --gid "$SDD_HOST_GID" vscode; \
      fi; \
    fi; \
    if [ "$SDD_HOST_UID" != "$current_uid" ]; then \
      existing_user="$(getent passwd "$SDD_HOST_UID" | cut -d: -f1 || true)"; \
      if [ -n "$existing_user" ] && [ "$existing_user" != "vscode" ]; then \
        echo "Requested uid $SDD_HOST_UID is already used by $existing_user" >&2; exit 1; \
      fi; \
      usermod --uid "$SDD_HOST_UID" vscode; \
    fi; \
    usermod --gid "$target_group" vscode; \
    mkdir -p /sdd-home; \
    chown -R vscode:"$target_group" /home/vscode /sdd-home; \
    chmod 700 /sdd-home

COPY .sdd/tool-versions.env /tmp/sdd-tool-versions.env
RUN . /tmp/sdd-tool-versions.env \
    && python3 -m pip install --break-system-packages --no-cache-dir "specify-cli==${SPECKIT_VERSION}" \
    && rm /tmp/sdd-tool-versions.env
RUN git config --system --add safe.directory /workspace

USER vscode
ENV HOME=/sdd-home

# Project-specific runtimes and tools belong below this line and must be recorded in Docs/Tech-Stack.md.
