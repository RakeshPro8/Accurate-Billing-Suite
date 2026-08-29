import { Router, type IRouter } from "express";
import { requireAuth, loadEmployee, requireRole } from "../lib/auth";
import healthRouter from "./health";
import authRouter from "./auth";
import backupRouter from "./backup";
import productsRouter from "./products";
import servicesRouter from "./services";
import customersRouter from "./customers";
import salesRouter from "./sales";
import quotationsRouter from "./quotations";
import reportsRouter from "./reports";
import settingsRouter from "./settings";
import employeesRouter from "./employees";
import repairsRouter from "./repairs";
import storesRouter from "./stores";
import auditLogsRouter from "./auditLogs";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);

router.use(loadEmployee);
router.use(requireAuth);
router.use("/products", productsRouter);
router.use("/services", servicesRouter);
router.use("/customers", customersRouter);
router.use("/sales", salesRouter);
router.use("/quotations", quotationsRouter);
router.use("/reports", reportsRouter);
router.use("/settings", requireRole("admin"), settingsRouter);
router.use("/employees", requireRole("admin"), employeesRouter);
router.use("/repairs", repairsRouter);
router.use("/stores", requireRole("admin"), storesRouter);
router.use("/audit-logs", auditLogsRouter);
router.use(requireRole("admin"), backupRouter);

export default router;
