import { Navigate } from "react-router-dom";
import { DetailPageHeader } from "@/components/common/DetailPageHeader";
import { ModelCatalogTab } from "@/components/models/ModelCatalogTab";

export function ModelCatalogPage() {
  return (
    <div className="flex flex-col gap-5">
      <DetailPageHeader
        back={{ href: "/models", label: "返回模型列表" }}
        title="参考模型"
      />
      <ModelCatalogTab />
    </div>
  );
}

/** 旧路由兼容：/model-catalog → /models/catalog */
export function ModelCatalogRedirect() {
  return <Navigate to="/models/catalog" replace />;
}
