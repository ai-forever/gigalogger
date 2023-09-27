import { prisma } from "@/src/server/db";
import { type NextApiRequest, type NextApiResponse } from "next";
import { z } from "zod";
import { cors, runMiddleware } from "@/src/features/public-api/server/cors";
import { verifyAuthHeaderAndReturnScope } from "@/src/features/public-api/server/apiAuth";

const DatasetRunsGetSchema = z.object({
  name: z.string(),
  runName: z.string(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await runMiddleware(req, res, cors);

  // CHECK AUTH
  const authCheck = await verifyAuthHeaderAndReturnScope(
    req.headers.authorization,
  );
  if (!authCheck.validKey)
    return res.status(401).json({
      success: false,
      message: authCheck.error,
    });
  // END CHECK AUTH

  if (authCheck.scope.accessLevel !== "all") {
    return res.status(401).json({
      success: false,
      message:
        "Access denied - need to use basic auth with secret key to GET dataset runs",
    });
  }

  if (req.method === "GET") {
    try {
      console.log(
        "trying to get dataset runs, project ",
        authCheck.scope.projectId,
        ", body:",
        JSON.stringify(req.body, null, 2),
        ", query:",
        JSON.stringify(req.query, null, 2),
      );
      const { name, runName } = DatasetRunsGetSchema.parse(req.query);

      const datasetRuns = await prisma.datasetRuns.findMany({
        where: {
          name: runName,
          dataset: {
            name: name,
            projectId: authCheck.scope.projectId,
          },
        },
        include: {
          datasetRunItems: true,
        },
      });

      if (datasetRuns.length > 1) {
        console.error(
          "Found more than one dataset run with name",
          runName,
          "for dataset",
          name,
          "and project",
          authCheck.scope.projectId,
        );
        return res.status(500).json({
          success: false,
          message: "Found more than one dataset run with that name",
        });
      }
      if (!datasetRuns[0])
        return res.status(404).json({
          success: false,
          message: "Dataset run not found",
        });

      return res.status(200).json(datasetRuns[0]);
    } catch (error: unknown) {
      console.error(error);
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      res.status(400).json({
        success: false,
        message: "Invalid request data",
        error: errorMessage,
      });
    }
  } else {
    return res.status(405).json({ message: "Method not allowed" });
  }
}