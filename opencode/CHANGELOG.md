OpenCode now connects to Home Assistant's MCP server when it starts, so the agent can read states and call actions without any setup. Turn it off with the new `home_assistant_mcp` option.

It also connects, through Home Assistant, to the MCP servers you've added to Home Assistant's Model Context Protocol Client integration, so the agent gets their tools too.

Set the new `music_assistant_token` option to a Music Assistant token, and the agent can use Music Assistant's API, and its MCP server when the plugin is on.

The app now runs [ha-bridge](https://ha-bridge.timmo.dev), so the agent can read and control Home Assistant from the shell: watch states, render templates, change automations and scripts, and read Home Assistant's logs. Its skills come with it and update with it. Turn it off with the new `ha_bridge` option.

The app now has the Supervisor's `homeassistant` role, which lets ha-bridge read Core's logs, including past boots.

There's a second app, **OpenCode (manager access)**, on the same image with the Supervisor's manager role, so the agent can read every log and manage your apps and host. It lowers the app's security rating, and uses port 49375 on your network. See "The two apps" in the documentation.

The agent now has built-in skills for the app's environment, Home Assistant and Music Assistant, and knows where it's running.
