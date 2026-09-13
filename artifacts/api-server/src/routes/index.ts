import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dukaRouter from "./duka";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dukaRouter);

export default router;
