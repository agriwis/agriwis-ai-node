/** 自定义 function 工具（OpenAI 兼容格式，函数由你的应用执行） */
export interface FunctionTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    /** JSON Schema 形式的参数描述 */
    parameters: Record<string, unknown>;
  };
}

/**
 * 蜀农内置工具：知识库检索。
 * 检索平台内置的农业专业知识库，为回答提供可追溯的知识依据。
 */
export interface KnowledgeSearchTool {
  type: 'agriwis_knowledge_search';
  /** 必填。检索的问题内容 */
  query: string;
  /** 可选。指定知识库编码，不传则检索全部活跃知识库 */
  kb_code?: string;
  /** 可选。相关度阈值（0-1），默认取工具配置（通常 0.7）；仅对向量与精排阶段生效，传 0 表示不过滤 */
  score_threshold?: number;
  /** 可选。返回的片段数量，默认 5，上限 20 */
  top_k?: number;
  /** 可选。是否启用重排序，默认 false */
  use_rerank?: boolean;
}

/**
 * 蜀农内置工具：天气搜索。
 * 查询中国大陆城市的实时天气或未来 7 日天气预报。
 */
export interface WeatherSearchTool {
  type: 'agriwis_weather_search';
  /** 可选。城市名（如「成都」）、区县名（如「双流区」）、9 位城市编码，或坐标「纬度,经度」；与 latitude+longitude 至少提供一个 */
  location?: string;
  /** 可选。纬度（-90~90），需与 longitude 同时提供；按区县级反查 */
  latitude?: number;
  /** 可选。经度（-180~180），需与 latitude 同时提供 */
  longitude?: number;
  /** 可选。省/市关键字，用于同名区县消歧（如「北京」「吉林」） */
  province?: string;
  /** 可选。now=实时天气（默认）；forecast 或 YYYY-MM-DD=该日期起未来 7 日预报 */
  date?: 'now' | 'forecast' | (string & {});
}

/**
 * 蜀农内置工具：生长周期识别。
 * 识别作物图片中的种类与生长阶段，返回阶段判断与农事建议。
 */
export interface CropGrowthTool {
  type: 'agriwis_crop_growth';
  /** 可选。图片 http(s) 地址、data URI 或纯 base64；省略时自动使用用户最新上传的图片 */
  image_url?: string;
  /** 可选。识别类型；不传时由系统自动判断 */
  recognition_type?: 'wheat_stage' | 'tea_count' | 'tea_stage';
}

/**
 * 蜀农内置工具：获取当前时间。
 * 返回指定时区的日期与时间，常用于农事提醒、节气计算、任务调度。
 */
export interface CurrentTimeTool {
  type: 'agriwis_get_current_time';
  /** 可选。输出格式（Java DateTimeFormatter 模式），如 yyyy-MM-dd HH:mm:ss（默认） */
  format?: string;
  /** 可选。IANA 时区标识，默认 Asia/Shanghai */
  timezone?: string;
  /** 可选。true（或 yes）返回当年 24 节气完整列表；传四位年份（如 2026）返回该年份列表；不传只返回当前/下一节气 */
  with_solar_terms?: boolean | number;
}

/**
 * tools 参数类型：蜀农内置工具（扁平结构）与自定义 function 工具（嵌套结构）
 * 以 type 字段天然可区分，构成判别联合。
 */
export type Tool =
  | FunctionTool
  | KnowledgeSearchTool
  | WeatherSearchTool
  | CropGrowthTool
  | CurrentTimeTool;

/** 控制是否以及调用哪个工具 */
export type ToolChoice =
  | 'none'
  | 'auto'
  | 'required'
  | { type: 'function'; function: { name: string } };
