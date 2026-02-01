#!/command/with-contenv bashio
# ==============================================================================
# Home Assistant OpenCode App
# Clone configured repositories using GitHub CLI
# ==============================================================================

readonly REPOS_DIR="/data/repos"

# Create repos directory
mkdir -p "${REPOS_DIR}"

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
        gh repo clone "${repo}" "${repo_path}" -- --depth 1 || bashio::log.warning "Failed to clone ${repo}"
    fi
done

bashio::log.info "Repository setup complete"
