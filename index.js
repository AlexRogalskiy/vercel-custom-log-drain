const https = require("https");
const { withUiHook, htm } = require("@zeit/integration-utils");

const API = "https://api.vercel.com/v1/integrations/log-drains";

module.exports = withUiHook(async ({ payload, zeitClient }) => {
  const { action, clientState } = payload;
  let apiOptions = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.token}`,
    },
  };
  let errorMessage = "";
  let successMessage = "";

  await zeitClient.getMetadata();

  // 1. Get Log Drains on every request
  let logDrains = [];
  await new Promise((resolve) => {
    let rawData = "";
    https.request(API, apiOptions, (req) => {
      req.on("error", (err) => {
        errorMessage = err.toString() || err;
        resolve();
      });
      req.on("data", (chunk) => {
        rawData += chunk;
      });
      req.on("end", () => {
        logDrains = JSON.parse(rawData);
        resolve();
      });
    });
  });

  if (action === "create") {
    const { name, type, url, projectId } = clientState;
    await new Promise((resolve) => {
      let rawData = "";
      https.request(
        API,
        {
          ...apiOptions,
          method: "POST",
          body: JSON.stringify({
            name,
            type,
            url,
            projectId: projectId || (payload.project && payload.project.id),
          }),
        },
        (req) => {
          req.on("error", (err) => {
            errorMessage = err.toString() || err;
            resolve();
          });
          req.on("data", (chunk) => {
            rawData += chunk;
          }); // why are you needed
          req.on("end", () => {
            const data = JSON.parse(rawData);
            successMessage = `${data.id} successfully created`;
            resolve();
          });
        }
      );
    });
  } else if (action.startsWith("delete-")) {
    const id = action.replace("delete-", "");
    await new Promise((resolve) => {
      https.request(
        `${API}/${id}`,
        { ...apiOptions, method: "DELETE" },
        (req) => {
          req.on("error", (err) => {
            errorMessage = err.toString() || err;
            resolve();
          });
          req.on("data", () => {}); // why are you needed
          req.on("end", () => {
            successMessage = `${id} successfully deleted.`;
            resolve();
          });
        }
      );
    });
  }

  return htm`
    <Page>
      ${errorMessage ? `<Notice type="error">${errorMessage}</Notice>` : ""}
      ${
        successMessage
          ? `<Notice type="success">${successMessage}</Notice>`
          : ""
      }
      <Container>
        <Box display="flex">
          <Box flex="1">
            <H1>Vercel Custom Log Drain</H1>
            <P>To learn what these controls do, see <Link href="https://vercel.com/docs/api#integrations/log-drains">the documentation</Link>.</P>
          </Box>
          <Box flex="1" justifyContent="flex-end"><ProjectSwitcher message="Choose a project from the list" /></Box>
        </Box>
      </Container>
      <Container>
        <Fieldset>
          <FsContent>
          <H2>Active Log Drains</H2>
          ${
            logDrains.length
              ? logDrains.map(
                  (drain) =>
                    htm`<Box display="flex">
                  <Box flex-grow="1"><B>${drain.name}</B> (${drain.url})</Box>
                  <Box flex-grow="0"><Button action="delete-${drain.id}" small type="error">Delete</Button></Box>
                </Box>`
                )
              : htm`No Log Drains for this project. Add one below.`
          }
          </FsContent>
        </Fieldset>
      </Container>
      <Container>
        <Fieldset>
          <FsContent>
            <H2>New Log Drain</H2>
            <Box display="flex" marginTop="1rem">
              <Box flex="1"><Input label="Name" name="name" required width="calc(100% - 2rem)" type="text" autocapitalize="off" autocomplete="off" /></Box>
              <Box flex="1" paddingTop="1.25rem">The name of the drain.</Box>
            </Box>
            <Box display="flex" marginTop="1rem">
              <Box flex="1">
                <Select label="Type" name="type" required width="calc(100% - 2rem)" >
                  <Option value="json" caption="JSON" />
                  <Option value="ndjson" caption="NDJSON" />
                  <Option value="syslog" caption="Syslog" />
                </Select>
              </Box>
              <Box flex="1" paddingTop="1.25rem">The type of log format, one of <B>json</B>, <B>ndjson</B> or <B>syslog</B>.</Box>
            </Box>
            <Box display="flex" marginTop="1rem">
              <Box flex="1"><Input label="URL" name="url" type="text" required width="calc(100% - 2rem)" autocapitalize="off" autocomplete="off" /></Box>
              <Box flex="1" paddingTop="1.25rem">The URL where you will receive logs. The protocol must be <B>https://</B> or <B>http://</B> for the type “json” and “ndjson,” <B>syslog+tls:</B> or <B>syslog:</B> for the type “syslog.“</Box>
            </Box>
            <Box display="flex" marginTop="1rem">
              <Box flex="1"><Input label="Project ID" name="projectId" type="text" width="calc(100% - 2rem)" autocapitalize="off" autocomplete="off" value="${
                payload.project ? payload.project.id : ""
              }" /></Box>
              <Box flex="1" paddingTop="1.25rem">(optional) The ID of a project to subscribe.</Box>
            </Box>
          </FsContent>
          <FsFooter>
            <Box display="flex" width="100%" justifyContent="flex-end">
              <Button action="create">Create</Button>
            </Box>
          </FsFooter>
        </Fieldset>
      </Container>
    </Page>
`;
});
