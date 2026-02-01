#!/command/with-contenv bashio
# ==============================================================================
# Home Assistant OpenCode App
# Clone configured repositories using GitHub CLI
# ==============================================================================

readonly REPOS_DIR="/data/repos"
readonly GH_CONFIG_DIR="/data/.config/gh"
readonly SSH_DIR="/data/.ssh"
readonly GITCONFIG="/data/.gitconfig"

# Create directories
mkdir -p "${REPOS_DIR}"
mkdir -p "${GH_CONFIG_DIR}"
mkdir -p "${SSH_DIR}"
chmod 700 "${SSH_DIR}"

# Symlink gh config to persistent storage
mkdir -p /root/.config
if [[ ! -L /root/.config/gh ]]; then
    rm -rf /root/.config/gh
    ln -s "${GH_CONFIG_DIR}" /root/.config/gh
fi

# Symlink ssh directory to persistent storage
if [[ ! -L /root/.ssh ]]; then
    rm -rf /root/.ssh
    ln -s "${SSH_DIR}" /root/.ssh
fi

# Symlink gitconfig to persistent storage
if [[ ! -L /root/.gitconfig ]]; then
    rm -f /root/.gitconfig
    ln -s "${GITCONFIG}" /root/.gitconfig
fi

# Initialize gitconfig with required settings if it doesn't exist
if [[ ! -f "${GITCONFIG}" ]]; then
    bashio::log.info "Initializing git configuration..."
    
    # Use SSH for GitHub
    git config --global url."git@github.com:".insteadOf "https://github.com/"
    
    # Trust /data directories
    git config --global safe.directory /data
fi

# Check if gh is authenticated
GH_AUTHENTICATED=false
if gh auth status &>/dev/null; then
    GH_AUTHENTICATED=true
else
    bashio::log.warning "GitHub CLI not authenticated. Run 'gh auth login' from OpenCode terminal to authenticate (select SSH)."
fi

# Check if repositories are configured
if ! bashio::config.has_value 'repositories'; then
    bashio::log.info "No repositories configured"
    exit 0
fi

# Get the number of repositories
repo_count=$(bashio::config 'repositories | length')
bashio::log.info "Found ${repo_count} repositories to clone"

# Iterate through each repository
for i in $(seq 0 $((repo_count - 1))); do
    repo=$(bashio::config "repositories[${i}]")
    
    # Extract repo name from owner/repo format
    repo_name=$(basename "${repo}")
    repo_path="${REPOS_DIR}/${repo_name}"
    
    if [[ -d "${repo_path}" ]]; then
        bashio::log.info "Repository ${repo} already exists at ${repo_path}, pulling latest..."
        git -C "${repo_path}" pull --ff-only || bashio::log.warning "Failed to pull ${repo}"
    else
        bashio::log.info "Cloning repository ${repo} to ${repo_path}..."
        if [[ "${GH_AUTHENTICATED}" == "true" ]]; then
            git clone --depth 1 "git@github.com:${repo}.git" "${repo_path}" || bashio::log.warning "Failed to clone ${repo}"
        else
            git clone --depth 1 "https://github.com/${repo}.git" "${repo_path}" || bashio::log.warning "Failed to clone ${repo}"
        fi
    fi
done

bashio::log.info "Repository setup complete"
