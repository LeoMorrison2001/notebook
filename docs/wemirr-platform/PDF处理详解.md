# PDF 处理详解

> 模块路径: `wemirr-platform-framework/pdf-spring-boot-starter`
> 包路径: `com.wemirr.framework.pdf`

## 概述

`pdf-spring-boot-starter` 是基于 **iText Html2Pdf** 的 PDF 生成模块，提供：
- HTML 模板转 PDF（FreeMarker）
- 中文字体支持
- 水印功能
- 页码显示（第X页/共Y页）
- 自定义事件处理器

---

## 核心原理

### 生成流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        PDF 生成流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 准备数据模型                                                 │
│     │  Map<String, Object> model = {...}                        │
│     │                                                            │
│  2. 加载 FreeMarker 模板                                         │
│     │  template = cfg.getTemplate("report.ftl")                │
│     │                                                            │
│  3. 渲染模板为 HTML                                              │
│     │  template.process(model, out)                            │
│     │  → <html>...</html>                                        │
│     │                                                            │
│  4. HTML 转 PDF                                                 │
│     │  HtmlConverter.convertToPdf(html, pdfDocument)            │
│     │  ├─ 添加中文字体                                          │
│     │  ├─ 添加水印                                              │
│     │  └─ 添加页码                                              │
│     │                                                            │
│  5. 输出到响应流                                                 │
│     │  response.getOutputStream().write(pdfBytes)              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
pdf/
├── configuration/
│   ├── PDFAutoConfiguration.java    # 自动配置
│   └── PDFTemplate.java             # PDF 模板引擎
├── domain/
│   └── PDFDomain.java               # PDF 配置实体
├── handler/
│   ├── WaterMarkEventHandler.java    # 水印处理器
│   └── PageEventHandler.java         # 页码处理器
└── utils/
    └── HtmlToPdfUtils.java           # HTML 转 PDF 工具
```

---

## 核心类详解

### 1. PDFTemplate - PDF 模板引擎

**文件**: [PDFTemplate.java](../wemirr-platform-framework/pdf-spring-boot-starter/src/main/java/com/wemirr/framework/pdf/configuration/PDFTemplate.java)

```java
@Component
public class ReportService {
    
    @Autowired
    private PDFTemplate pdfTemplate;
    
    public void exportReport(HttpServletResponse response) {
        PDFDomain domain = PDFDomain.builder()
                .fileName("销售报表")
                .templateName("report.ftl")
                .watermark("内部资料")
                .model(dataModel)
                .build();
        
        pdfTemplate.export(domain, response);
    }
}
```

---

### 2. PDFDomain - PDF 配置实体

**文件**: [PDFDomain.java](../wemirr-platform-framework/pdf-spring-boot-starter/src/main/java/com/wemirr/framework/pdf/domain/PDFDomain.java)

| 属性 | 类型 | 说明 |
|------|------|------|
| `fileName` | String | 导出的文件名 |
| `templateName` | String | FreeMarker 模板文件名 |
| `watermark` | String | 水印内容（可选） |
| `model` | Map | 模板数据模型 |

---

### 3. 事件处理器

#### WaterMarkEventHandler - 水印处理器

**文件**: [WaterMarkEventHandler.java](../wemirr-platform-framework/pdf-spring-boot-starter/src/main/java/com/wemirr/framework/pdf/handler/WaterMarkEventHandler.java)

```java
// 默认：5列 x 5行 = 25个水印/页
new WaterMarkEventHandler("内部资料")

// 自定义行列数
new WaterMarkEventHandler("机密", 3, 4)  // 3列 x 4行
```

**效果**: 每页铺满半透明水印文字

---

#### PageEventHandler - 页码处理器

**文件**: [PageEventHandler.java](../wemirr-platform-framework/pdf-spring-boot-starter/src/main/java/com/wemirr/framework/pdf/handler/PageEventHandler.java)

**效果**: 页面底部显示 "第X页/共Y页"

---

## 使用示例

### 1. 基础用法

```java
// 1. 创建 FreeMarker 模板
// resources/templates/report.ftl
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>销售报表</title>
    <style>
        body { font-family: SimSun; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #333; padding: 8px; }
        th { background-color: #f0f0f0; }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <p>生成时间: ${createTime}</p>
    <table>
        <thead>
            <tr>
                <th>序号</th>
                <th>商品名称</th>
                <th>销量</th>
                <th>金额</th>
            </tr>
        </thead>
        <tbody>
            <#list items as item>
            <tr>
                <td>${item_index + 1}</td>
                <td>${item.name}</td>
                <td>${item.count}</td>
                <td>${item.amount}</td>
            </tr>
            </#list>
        </tbody>
    </table>
</body>
</html>

// 2. Controller 导出
@Controller
public class ReportController {
    
    @Autowired
    private PDFTemplate pdfTemplate;
    
    @GetMapping("/report/export")
    public void exportReport(HttpServletResponse response) {
        // 准备数据
        Map<String, Object> model = new HashMap<>();
        model.put("title", "2024年销售报表");
        model.put("createTime", LocalDateTime.now());
        
        List<Item> items = List.of(
            new Item("商品A", 100, new BigDecimal("1000.00")),
            new Item("商品B", 200, new BigDecimal("2000.00"))
        );
        model.put("items", items);
        
        // 构建 PDF 配置
        PDFDomain domain = PDFDomain.builder()
                .fileName("销售报表")
                .templateName("report.ftl")
                .watermark("内部资料")
                .model(model)
                .build();
        
        // 导出
        pdfTemplate.export(domain, response);
    }
}
```

---

### 2. 自定义水印

```java
// 无水印
PDFDomain.builder()
    .fileName("report")
    .templateName("template.ftl")
    .model(model)
    .build();

// 简单水印
PDFDomain.builder()
    .watermark("机密文件")
    .build();

// 自定义水印密度（需要手动构建事件处理器）
Map<String, List<IEventHandler>> handlers = Map.of(
    PdfDocumentEvent.END_PAGE,
    List.of(new WaterMarkEventHandler("机密", 3, 3))  // 3列 x 3行
);
pdfTemplate.export(handlers, domain, response);
```

---

### 3. 模板语法（FreeMarker）

```html
<!-- 变量输出 -->
<p>${title}</p>

<!-- 条件判断 -->
<#if user.vip>
    <p>VIP用户</p>
<#else>
    <p>普通用户</p>
</#if>

<!-- 列表循环 -->
<table>
    <#list items as item>
        <tr>
            <td>${item.name}</td>
            <td>${item.price}</td>
        </tr>
    </#list>
</table>

<!-- 格式化数字 -->
<#setting number_format=",###.00">
<p>${amount}</p>  <!-- 1,234.56 -->

<!-- 格式化日期 -->
<#setting date_format="yyyy-MM-dd HH:mm:ss">
<p>${createTime}</p>  <!-- 2024-04-09 10:30:00 -->
```

---

### 4. 中文字体支持

框架默认使用 **STSongStd-Light** (华文宋体) 支持中文

```java
// HtmlToPdfUtils.java 中已配置
PdfFont sysFont = PdfFontFactory.createFont("STSongStd-Light", "UniGB-UCS2-H");
fontProvider.addFont(sysFont.getFontProgram(), "UniGB-UCS2-H");
```

**如需使用其他字体**:

```java
// 1. 将字体文件放到 resources/fonts/
// 2. 修改 HtmlToPdfUtils
PdfFont customFont = PdfFontFactory.createFont(
    "fonts/CustomFont.ttf",  // 相对于 classpath
    "Identity-H"  // 支持 Unicode
);
```

---

### 5. 工具类直接使用

```java
// 使用工具类直接转换
@Autowired
private HtmlToPdfUtils htmlToPdfUtils;

public void convert(String html, OutputStream out) {
    InputStream in = new ByteArrayInputStream(html.getBytes());
    
    // 带水印转换
    htmlToPdfUtils.html2WaterMarkPdf(in, "水印文字", out);
    
    // 自定义事件处理器
    Map<String, List<IEventHandler>> handlers = Map.of(
        PdfDocumentEvent.END_PAGE,
        List.of(new WaterMarkEventHandler("水印"), new PageEventHandler())
    );
    htmlToPdfUtils.html2Pdf(handlers, in, out);
}
```

---

### 6. 保存到文件

```java
@Service
public class PDFService {
    
    @Autowired
    private PDFTemplate pdfTemplate;
    
    public String generateToFile(PDFDomain domain, String filePath) {
        try (FileOutputStream fos = new FileOutputStream(filePath)) {
            // 渲染模板
            Template template = cfg.getTemplate(domain.getTemplateName());
            StringWriter out = new StringWriter();
            template.process(domain.getModel(), out);
            
            // 转换为 PDF
            InputStream is = new ByteArrayInputStream(out.toString().getBytes());
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            
            html2Pdf(null, is, bos);
            
            // 写入文件
            fos.write(bos.toByteArray());
            
            return filePath;
        } catch (Exception e) {
            throw new RuntimeException("PDF生成失败", e);
        }
    }
}
```

---

## 模板最佳实践

### 1. 样式建议

```html
<style>
    /* 使用简单样式，避免复杂 CSS */
    body {
        font-family: SimSun, "STSongStd-Light";
        font-size: 14px;
        line-height: 1.6;
    }
    
    /* 表格样式 */
    table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
    }
    th, td {
        border: 1px solid #333;
        padding: 8px;
        text-align: center;
    }
    th {
        background-color: #f0f0f0;
        font-weight: bold;
    }
    
    /* 避免使用浮动、定位等复杂布局 */
</style>
```

### 2. 分页控制

```html
<!-- 避免内容被分页截断 -->
<div style="page-break-inside: avoid;">
    <table>
        <!-- 表格内容 -->
    </table>
</div>

<!-- 强制分页 -->
<div style="page-break-after: always;"></div>

<!-- 在某元素前分页 -->
<div style="page-break-before: always;"></div>
```

---

## 配置说明

### 模板路径

默认模板路径：`resources/templates/`

```java
// PDFTemplate.java
cfg.setClassForTemplateLoading(this.getClass(), "/templates");
```

---

## 常见问题 (Q&A)

### Q1: 中文显示为乱码或方框？

**A**: 确保使用了支持中文的字体

```java
// 框架默认配置
PdfFont sysFont = PdfFontFactory.createFont("STSongStd-Light", "UniGB-UCS2-H");

// 检查模板中的字体设置
<style>
    body {
        font-family: STSongStd-Light, SimSun, sans-serif;
    }
</style>
```

---

### Q2: 如何调整水印位置和密度？

**A**: 修改 WaterMarkEventHandler 构造参数

```java
// 默认：5列 x 5行
new WaterMarkEventHandler("水印")

// 自定义行列数（行列间距越大，水印越稀疏）
new WaterMarkEventHandler("水印", 3, 3)  // 3列 x 3行，水印更少

// 或者直接修改 WaterMarkEventHandler.java 中的坐标计算
canvas.showTextAligned(waterMark, x, y, page, 
    TextAlignment.CENTER, VerticalAlignment.BOTTOM, 120);
//                                              ↑
//                                        旋转角度（可调整）
```

---

### Q3: 如何添加 Logo 图片？

**A**: 在模板中使用 HTML `<img>` 标签

```html
<!-- 图片路径相对于 classpath -->
<img src="/templates/logo.png" style="width: 100px; height: 50px;">

<!-- 或者使用 Base64（不推荐，文件会很大） -->
<img src="data:image/png;base64,iVBORw0KGgoAAAANS..." />
```

---

### Q4: 如何设置纸张大小和方向？

**A**: 需要自定义 ConverterProperties

```java
// 创建 PDFTemplate 子类覆盖方法
public class CustomPDFTemplate extends PDFTemplate {
    
    @Override
    public void export(PDFDomain domain, HttpServletResponse response) {
        // ...渲染模板
        
        try (InputStream is = new ByteArrayInputStream(out.toString().getBytes());
             ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            
            PdfWriter pdfWriter = new PdfWriter(bos);
            PdfDocument pdfDocument = new PdfDocument(pdfWriter);
            
            // 设置纸张大小和方向
            pdfDocument.setDefaultPageSize(PageSize.A4.rotate());  // A4 横向
            // pdfDocument.setDefaultPageSize(new PageSize(595, 842));  // 自定义尺寸
            
            HtmlConverter.convertToPdf(is, pdfDocument, properties);
            // ...
        }
    }
}
```

---

### Q5: 如何处理动态页数？

**A**: PageEventHandler 已自动处理

```java
// 页码显示格式：第X页/共Y页
// document.getPageNumber(page)  → 当前页码
// document.getNumberOfPages()   → 总页数

// 修改显示格式
Paragraph paragraph = new Paragraph(
    "第 " + document.getPageNumber(page) + " 页"  // 只显示当前页
)
```

---

## 学习建议

1. **先掌握 FreeMarker 语法**: 模板是核心
2. **使用简单样式**: PDF 对 CSS 支持有限
3. **测试分页效果**: 多页内容注意分页
4. **中文字体**: 确保字体正确配置

---

## 下一步学习

- [国际化](../wemirr-platform-framework/i18n-spring-boot-starter) - 多语言支持
- [MongoDB](../wemirr-platform-framework/mongodb-plus-spring-boot-starter) - NoSQL 支持
- [AI 集成](../wemirr-platform-framework/ai-spring-boot-starter) - Langchain4j 集成
