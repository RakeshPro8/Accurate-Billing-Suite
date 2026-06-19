import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import servicesRouter from "./services";
import customersRouter from "./customers";
import salesRouter from "./sales";
import quotationsRouter from "./quotations";
import reportsRouter from "./reports";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/products", productsRouter);
router.use("/services", servicesRouter);
router.use("/customers", customersRouter);
router.use("/sales", salesRouter);
router.use("/quotations", quotationsRouter);
router.use("/reports", reportsRouter);
router.use("/settings", settingsRouter);

export default router;
