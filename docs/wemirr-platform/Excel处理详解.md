# Excel 处理详解

> 模块路径: `wemirr-platform-framework/easyexcel-spring-boot-starter`
> 包路径: `com.wemirr.framework.excel`

## 概述

`easyexcel-spring-boot-starter` 是基于 **EasyExcel** 的 Excel 导入导出增强模块，提供：
- `@RequestExcel` - Excel 导入（自动解析 + 校验）
- `@ResponseExcel` - Excel 导出（注解即用）
- 支持多 Sheet
- 支持模板导出
- 支持国际化表头
- 数据校验集成

---

## 核心原理

### 导出流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        导出流程                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Controller 返回数据                                         │
│     │                                                            │
│     ▼                                                            │
│  2. @ResponseExcel 注解拦截                                      │
│     │  ├─ 解析注解配置                                           │
│     │  ├─ 构建 ExcelWriteFile                                   │
│     │  └─ 选择 SheetWriteHandler                                │
│     │                                                            │
│  3. EasyExcel 写入                                              │
│     │  ├─ 根据实体类注解生成表头                                 │
│     │  ├─ 写入数据                                               │
│     │  └─ 应用样式/格式                                          │
│     │                                                            │
│  4. 设置响应头                                                  │
│     │  ├─ Content-Type: application/vnd.ms-excel               │
│     │  └─ Content-Disposition: attachment; filename=xxx.xlsx   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 导入流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        导入流程                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 前端上传 Excel 文件                                         │
│     │                                                            │
│     ▼                                                            │
│  2. @RequestExcel 参数解析                                       │
│     │  ├─ 获取 MultipartFile                                    │
│     │  ├─ 创建 ValidateAnalysisEventListener                   │
│     │  └─ 调用 EasyExcel.read()                                │
│     │                                                            │
│  3. 逐行解析 Excel                                              │
│     │  ├─ 读取表头                                              │
│     │  ├─ 映射到实体类                                          │
│     │  └─ 触发监听器                                            │
│     │                                                            │
│  4. 数据校验                                                    │
│     │  ├─ JSR-303 校验                                          │
│     │  ├─ 自定义校验                                            │
│     │  └─ 收集错误信息到 BindingResult                          │
│                                                                  │
│  5. 返回解析后的 List<T>                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
easyexcel/
├── annotation/
│   ├── RequestExcel.java          # 导入注解
│   ├── ResponseExcel.java         # 导出注解
│   ├── Sheet.java                 # Sheet 配置
│   └── ExcelLine.java             # 行注解
├── configuration/
│   ├── EasyExcelAutoConfigure.java # 自动配置
│   ├── EasyExcelProperties.java   # 配置属性
│   └── ExcelHandlerConfiguration.java
├── domain/
│   ├── ExcelReadFile.java         # 导入文件模型
│   ├── ExcelWriteFile.java        # 导出文件模型
│   └── SheetInfo.java             # Sheet 信息
├── handler/
│   ├── read/                      # 读取处理器
│   │   └── ValidateAnalysisEventListener.java
│   ├── write/                     # 写入处理器
│   │   └── SingleSheetWriteHandler.java
│   └── head/                      # 表头处理器
│       └── I18nHeaderCellWriteHandler.java
├── convert/
│   ├── InstantConverter.java      # 时间转换器
│   └── LocalDictConverter.java    # 字典转换器
└── web/
    ├── resolver/
    │   └── RequestExcelArgumentResolver.java # 参数解析器
    └── handler/
        └── ResponseExcelReturnValueHandler.java # 返回值处理器
```

---

## 核心注解

### 1. @ResponseExcel - 导出注解

**文件**: [ResponseExcel.java](../wemirr-platform-framework/easyexcel-spring-boot-starter/src/main/java/com/wemirr/framework/excel/annotation/ResponseExcel.java)

```java
@ResponseExcel(
    name = "用户列表",           // 文件名
    excelType = ExcelTypeEnum.XLSX,
    sheets = @Sheet(name = "用户数据")
)
public List<User> exportUsers() {
    return userService.list();
}
```

**参数说明**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `name` | String | "default" | 文件名 |
| `excelType` | ExcelTypeEnum | XLSX | 文件类型 |
| `sheets` | Sheet[] | @Sheet("sheet1") | Sheet 配置 |
| `password` | String | "" | 文件密码 |
| `template` | String | "" | 模板路径 |
| `include` | String[] | {} | 包含字段 |
| `exclude` | String[] | {} | 排除字段 |
| `i18nHeader` | boolean | false | 国际化表头 |

---

### 2. @RequestExcel - 导入注解

**文件**: [RequestExcel.java](../wemirr-platform-framework/easyexcel-spring-boot-starter/src/main/java/com/wemirr/framework/excel/annotation/RequestExcel.java)

```java
@PostMapping("/import")
public Result importUsers(@RequestExcel List<User> users, BindingResult result) {
    if (result.hasErrors()) {
        // 处理校验错误
        return Result.fail(result.getAllErrors());
    }
    userService.saveBatch(users);
    return Result.success();
}
```

**参数说明**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `fileName` | String | "file" | 上传文件字段名 |
| `password` | String | "" | 文件密码 |
| `readListener` | Class | DefaultValidateAnalysisEventListener.class | 监听器 |
| `ignoreEmptyRow` | boolean | false | 忽略空行 |
| `headRowNumber` | int | 1 | 表头行数 |
| `sheetNo` | int | 0 | Sheet 索引 |

---

### 3. @Sheet - Sheet 配置

```java
@ResponseExcel(
    name = "数据导出",
    sheets = {
        @Sheet(name = "用户", includes = {"id", "username", "email"}),
        @Sheet(name = "订单", includes = {"id", "orderNo", "amount"})
    }
)
public Map<String, List<?>> exportAll() {
    return Map.of(
        "用户", userService.list(),
        "订单", orderService.list()
    );
}
```

---

## 使用示例

### 1. 基础导出

```java
// 1. 定义实体类（使用 EasyExcel 注解）
@Data
public class User {
    @ExcelProperty("用户ID")
    private Long id;
    
    @ExcelProperty("用户名")
    private String username;
    
    @ExcelProperty("邮箱")
    private String email;
    
    @ExcelProperty("创建时间")
    private Instant createTime;
}

// 2. Controller 导出
@GetMapping("/export")
@ResponseExcel(name = "用户列表")
public List<User> export() {
    return userService.list();
}

// 前端访问
// GET /api/user/export
// 响应: Content-Disposition: attachment; filename=用户列表.xlsx
```

---

### 2. 字段过滤

```java
// 只导出指定字段
@ResponseExcel(
    name = "用户数据",
    include = {"id", "username", "email"}  // 只导出这3个字段
)
public List<User> exportFiltered() {
    return userService.list();
}

// 排除某些字段
@ResponseExcel(
    name = "用户数据",
    exclude = {"password", "salt"}  // 不导出敏感字段
)
public List<User> exportSafe() {
    return userService.list();
}
```

---

### 3. 多 Sheet 导出

```java
@ResponseExcel(
    name = "数据汇总",
    sheets = {
        @Sheet(name = "用户数据", includes = {"id", "username"}),
        @Sheet(name = "订单数据", includes = {"id", "orderNo"})
    }
)
public Map<String, List<?>> exportMultiple() {
    return Map.of(
        "用户数据", userService.list(),
        "订单数据", orderService.list()
    );
}

// 生成的 Excel 文件包含两个 Sheet
// ┌─────────────────────┐ ┌─────────────────────┐
// │   Sheet1: 用户数据   │ │   Sheet2: 订单数据   │
// ├─────────────────────┤ ├─────────────────────┤
// │ 用户ID  │ 用户名    │ │ 订单ID  │ 订单号   │
// │ 1       │ 张三      │ │ 101     │ ORD001   │
// │ 2       │ 李四      │ │ 102     │ ORD002   │
// └─────────────────────┘ └─────────────────────┘
```

---

### 4. 模板导出

```java
// resources/template/user_template.xlsx
// | 用户ID | 用户名 | 邮箱 | 手机号 |
// |   1    |   张三 |      |       |

@ResponseExcel(
    name = "用户模板",
    template = "template/user_template.xlsx"  // 使用模板
)
public List<User> exportByTemplate() {
    return userService.list();
}

// 模板样式会被保留，数据填充到模板中
```

---

### 5. 导入 + 校验

```java
// 1. 定义实体类 + 校验注解
@Data
public class UserImport {
    
    @ExcelProperty("用户名")
    @NotBlank(message = "用户名不能为空")
    @Size(min = 2, max = 20, message = "用户名长度2-20字符")
    private String username;
    
    @ExcelProperty("邮箱")
    @Email(message = "邮箱格式不正确")
    private String email;
    
    @ExcelProperty("手机号")
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String phone;
}

// 2. Controller 导入
@PostMapping("/import")
public Result importUsers(@RequestExcel List<UserImport> users, BindingResult result) {
    if (result.hasErrors()) {
        // 获取错误信息
        List<FieldError> errors = result.getFieldErrors();
        return Result.validFail(errors);
    }
    
    // 校验通过，批量保存
    userService.saveBatch(users);
    return Result.success("导入成功");
}

// 3. 前端上传
// POST /api/user/import
// FormData: file = users.xlsx

// 4. 错误响应示例
{
  "code": -9,
  "message": "参数验证异常",
  "data": [
    {"field": "username", "message": "用户名不能为空", "row": 3},
    {"field": "email", "message": "邮箱格式不正确", "row": 5}
  ]
}
```

---

### 6. 自定义转换器

```java
// 1. 定义转换器
public class GenderConverter implements Converter<Integer> {
    
    @Override
    public Class<?> supportJavaTypeKey() {
        return Integer.class;
    }
    
    @Override
    public CellDataTypeEnum supportExcelTypeKey() {
        return CellDataTypeEnum.STRING;
    }
    
    @Override
    public Integer convertToJavaData(ReadCellData<?> cellData) {
        String gender = cellData.getStringValue();
        return switch (gender) {
            case "男" -> 1;
            case "女" -> 0;
            default -> null;
        };
    }
    
    @Override
    public WriteCellData<?> convertToExcelData(Integer value) {
        String gender = value == 1 ? "男" : "女";
        return new WriteCellData<>(gender);
    }
}

// 2. 实体类使用转换器
@Data
public class User {
    @ExcelProperty(value = "性别", converter = GenderConverter.class)
    private Integer gender;  // 1=男, 0=女
}

// 3. 导出时自动转换
// Excel: 性别 = 男/女
// 数据库: gender = 1/0
```

---

### 7. 国际化表头

```java
@ResponseExcel(
    name = "用户列表",
    i18nHeader = true  // 启用国际化
)
public List<User> export() {
    return userService.list();
}

// 实体类需要配合 i18n 模块使用
// 表头会根据当前语言自动翻译
// zh-CN: 用户名, 邮箱
// en-US: Username, Email
```

---

## 配置说明

### application.yml

```yaml
extend:
  boot:
    excel:
      # 模板路径
      template-path: "template"
      
      # 自动列宽（根据内容调整）
      auto-column-width: false
```

---

## 常见问题 (Q&A)

### Q1: 如何处理大数据量导出？

**A**: EasyExcel 本身针对大数据优化，不会一次性加载到内存

```java
// 分页查询 + 流式写入
@ResponseExcel(name = "全部用户")
public void exportAll(HttpServletResponse response) {
    // 方式1: 分页查询
    int pageSize = 10000;
    for (int i = 0; ; i++) {
        List<User> users = userService.page(i, pageSize);
        if (users.isEmpty()) break;
        // EasyExcel 会分批写入
    }
    
    // 方式2: 使用数据库游标
    userService.streamAll().forEach(user -> {
        // 流式处理
    });
}
```

---

### Q2: 如何自定义表头样式？

**A**: 使用 WriteHandler

```java
@ResponseExcel(
    name = "用户列表",
    writeHandlers = {CustomCellStyleHandler.class}
)
public List<User> export() {
    return userService.list();
}

// 自定义样式处理器
public class CustomCellStyleHandler implements CellWriteHandler {
    @Override
    public void afterCellDispose(CellWriteHandlerContext context) {
        // 设置表头样式
        if (context.getRow().getRowNum() == 0) {
            Cell cell = context.getCell();
            Workbook workbook = context.getWriteWorkbookHolder().getWorkbook();
            CellStyle style = workbook.createCellStyle();
            // 设置字体、颜色、边框...
            cell.setCellStyle(style);
        }
    }
}
```

---

### Q3: 导入时如何获取原始行号？

**A**: 使用 @ExcelLine 注解

```java
@Data
public class UserImport {
    
    @ExcelProperty("用户名")
    private String username;
    
    @ExcelLine  // 自动填充行号
    private Integer rowNum;  // 从0开始
}

// 使用
@PostMapping("/import")
public Result import(@RequestExcel List<UserImport> users) {
    users.forEach(user -> {
        log.info("第{}行: {}", user.getRowNum(), user.getUsername());
    });
}
```

---

### Q4: 如何处理复杂的表头？

**A**: 使用多级表头

```java
@Data
public class OrderExport {
    
    @ExcelProperty({"基础信息", "订单号"})
    private String orderNo;
    
    @ExcelProperty({"基础信息", "下单时间"})
    private Instant orderTime;
    
    @ExcelProperty({"客户信息", "客户名称"})
    private String customerName;
    
    @ExcelProperty({"客户信息", "联系电话"})
    private String customerPhone;
}

// 生成的表头
// ┌────────────────────┬────────────────────┐
    │   基础信息          │   客户信息          │
    ├──────────┬─────────┼──────────┬─────────┤
    │ 订单号   │ 下单时间 │ 客户名称 │ 联系电话 │
    └──────────┴─────────┴──────────┴─────────┘
```

---

### Q5: 如何导出图片？

**A**: 使用 URL 类型转换器

```java
@Data
public class ProductExport {
    
    @ExcelProperty("商品图片")
    private String imageUrl;  // URL 地址
}

// EasyExcel 会自动下载并插入图片
// 或者使用字节数组
@ExcelProperty(converter = ImageConverter.class)
private byte[] image;
```

---

## 学习建议

1. **先掌握基础导出**: @ResponseExcel + 实体类 @ExcelProperty
2. **理解导入校验**: @RequestExcel + JSR-303 校验
3. **学习转换器**: 处理特殊字段（枚举、字典、日期）
4. **大数据优化**: 分页查询、流式处理

---

## 下一步学习

- [WebSocket](../wemirr-platform-framework/websocket-spring-boot-starter) - 实时消息
- [国际化](../wemirr-platform-framework/i18n-spring-boot-starter) - 多语言支持
- [PDF 处理](../wemirr-platform-framework/pdf-spring-boot-starter) - PDF 生成
