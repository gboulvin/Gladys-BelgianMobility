# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainer for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## What the integration handles

- It needs **no credential**: iRail and Transitous are public APIs without
  account nor key. The only secret it holds is the integration token Gladys
  injects, which it never logs.
- It sends to those APIs only the stop identifiers, station names and journey
  stations configured by the user, over HTTPS, with a User-Agent naming the
  integration. It never sends the home location.
- It writes nothing to disk and runs as an unprivileged user on a read-only
  root filesystem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the third-party services the integration reads: iRail
([irail.be](https://irail.be)), Transitous ([transitous.org](https://transitous.org))
and the transport operators.
