# Feign 远程调用详解

> 模块路径: `wemirr-platform-framework/feign-plugin-spring-boot-starter`
> 包路径: `com.wemirr.framework.feign.plugin`

## 概述

`feign-plugin-spring-boot-starter` 是基于 **OpenFeign** 的微服务调用增强模块，提供：
- 自动解包 `Result` 响应
- Header 透传（认证/租户/链路追踪）
- Mock 服务支持（开发调试）
- 负载均衡增强
- 请求日志记录

---

## 核心原理

### Feign 调用流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        服务 A                                    │
│  ┌──────────────┐                                               │
│  │ @FeignClient │                                               │
│  │ userService  │                                               │
│  └──────┬───────┘                                               │
│         │ 1. 方法调用                                            │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              FeignPluginInterceptor                        │  │
│  │  - 透传 Header (Authorization, TenantId, TraceId...)      │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              MockLoadBalancerFeignClient                  │  │
│  │  - 负载均衡选择实例                                         │  │
│  │  - Mock 拦截（开发环境）                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  HTTP 请求                                 │  │
│  └────────────────────┬─────────────────────────────────────┘  │
└───────────────────────┼───────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                        服务 B                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Controller                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Result<User>                            │  │
│  │  {"code": 200, "data": {...}, "message": "success"}      │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────┼───────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              FeignResponseDecoder                         │  │
│  │  - 自动解包 Result.data                                   │  │
│  │  - 失败自动抛 CheckedException                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      User                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
feign-plugin/
├── FeignPluginConfiguration.java       # 自动配置
├── FeignPluginProperties.java          # 配置属性
├── decoder/
│   └── FeignResponseDecoder.java       # 响应解码器
└── mock/
    ├── FeignPluginInterceptor.java     # 请求拦截器
    ├── MockLoadBalancerFeignClient.java # Mock 负载均衡
    └── MockProperties.java             # Mock 配置
```

---

## 核心功能详解

### 1. 自动解包 Result

**问题**: 微服务间调用返回的是 `Result` 结构

```java
// 服务 B 返回
@GetMapping("/user/{id}")
public Result<User> getUser(@PathVariable Long id) {
    return Result.success(user);
}

// 服务 A 调用（传统方式）
@FeignClient(name = "user-service")
public interface UserClient {
    @GetMapping("/user/{id}")
    Result<User> getUser(@PathVariable Long id);
}

// 使用时需要手动解包
Result<User> result = userClient.getUser(1L);
if (!result.isSuccessful()) {
    throw new RuntimeException(result.getMessage());
}
User user = result.getData();  // 繁琐
```

**框架解决方案**: 自动解包

```java
// 服务 A 调用（框架增强）
@FeignClient(name = "user-service")
public interface UserClient {
    @GetMapping("/user/{id}")
    User getUser(@PathVariable Long id);  // 直接返回 User！
}

// 使用
User user = userClient.getUser(1L);
// 失败自动抛 CheckedException
```

**实现原理**: [FeignResponseDecoder.java](../wemirr-platform-framework/feign-plugin-spring-boot-starter/src/main/java/com/wemirr/framework/feign/plugin/decoder/FeignResponseDecoder.java)

```java
@Override
public Object decode(Response response, Type type) {
    // 如果返回类型不是 Result.class
    boolean notTheSame = method.getReturnType() != Result.class;

    if (notTheSame) {
        // 构造 Result<User> 类型
        Result<?> result = decoder.decode(response, Result<User>);

        // 失败自动抛异常
        if (!result.isSuccessful()) {
            throw new CheckedException(result.getCode(), result.getMessage());
        }

        // 只返回 data 部分
        return result.getData();
    }
}
```

---

### 2. Header 透传

**问题**: 微服务间调用需要传递认证、租户等 Header

```java
// 请求链路
用户 → 网关 → 服务 A → 服务 B
                │         │
            需要传递  这些信息
          Authorization  TenantId
          TraceId       ...
```

**框架解决方案**: 自动透传

**默认透传的 Header**:

| Header | 说明 |
|--------|------|
| `Authorization` | 认证 Token |
| `x-tenant-id` | 租户 ID |
| `TraceId` / `SpanId` | 链路追踪 |
| `x-request-id` | 请求 ID |
| `x-time-zone` | 时区 |
| `x-mock-application` | Mock 标识 |

**实现**: [FeignPluginInterceptor.java](../wemirr-platform-framework/feign-plugin-spring-boot-starter/src/main/java/com/wemirr/framework/feign/plugin/mock/FeignPluginInterceptor.java)

```java
@Override
public void apply(RequestTemplate template) {
    HttpServletRequest request = getCurrentRequest();

    // 透传核心 Header
    for (String headerName : CORE_HEADERS) {
        String headerValue = request.getHeader(headerName);
        if (StrUtil.isNotBlank(headerValue)) {
            template.header(headerName, headerValue);
        }
    }

    // 透传配置的额外 Header
    for (String headerName : properties.getAllowedHeaders()) {
        // ...
    }
}
```

**配置自定义 Header**:
```yaml
extend:
  feign:
    plugin:
      allowed-Headers:
        - x-custom-header
        - x-business-id
```

---

### 3. Mock 服务支持

**场景**: 开发时依赖的服务还没启动

**解决方案**: Mock 模式

```yaml
extend:
  feign:
    plugin:
      mock:
        enabled: true
        server-map:
          # 服务名: Mock 服务地址
          user-service:
            server-url: localhost:8081
            data-field: data  # 响应数据字段名
```

**工作原理**:
```
正常调用: user-service → 注册中心 → 真实服务实例
Mock 模式: user-service → localhost:8081 → Mock 服务器
```

**Mock 服务器示例** (使用 Mock.js 等):

```javascript
// Mock 服务器 (localhost:8081)
app.get('/user/:id', (req, res) => {
  res.json({
    code: 200,
    data: {
      id: req.params.id,
      name: "Mock User",
      email: "mock@example.com"
    }
  });
});
```

---

### 4. 负载均衡增强

**功能**: 调用失败时记录目标服务信息

**实现**: [FeignPluginConfiguration.java](../wemirr-platform-framework/feign-plugin-spring-boot-starter/src/main/java/com/wemirr/framework/feign/plugin/FeignPluginConfiguration.java)

```java
@Bean
public LoadBalancerLifecycle<Object, Object, ServiceInstance> logIpWhenError() {
    return new LoadBalancerLifecycle<>() {
        @Override
        public void onComplete(CompletionContext context) {
            if (context.status() == CompletionContext.Status.FAILED) {
                ServiceInstance instance = context.getLoadBalancerResponse().getServer();
                log.error("LoadBalancer调用失败 - 目标服务: {}, 地址: {}:{}",
                    instance.getServiceId(),
                    instance.getHost(),
                    instance.getPort());
            }
        }
    };
}
```

**日志输出**:
```
LoadBalancer调用失败 - 目标服务: user-service, 地址: 192.168.1.10:8080 - ConnectException
```

---

## 配置说明

### application.yml

```yaml
extend:
  feign:
    plugin:
      # 是否启用
      enabled: true

      # 日志级别
      level: FULL  # NONE, BASIC, HEADERS, FULL

      # 自定义透传 Header
      allowed-headers:
        - x-custom-header

      # Mock 配置
      mock:
        enabled: false
        server-map:
          user-service:
            server-url: localhost:8081
          order-service:
            server-url: localhost:8082
```

**日志级别说明**:

| 级别 | 说明 |
|------|------|
| `NONE` | 不记录日志 |
| `BASIC` | 记录请求方法和 URL |
| `HEADERS` | 记录请求头 |
| `FULL` | 记录完整请求/响应（含 Body） |

---

## 使用示例

### 基础用法

```java
// 1. 定义 Feign Client
@FeignClient(name = "user-service")
public interface UserClient {

    @GetMapping("/user/{id}")
    User getUser(@PathVariable("id") Long id);

    @PostMapping("/user")
    User createUser(@RequestBody UserSaveDTO dto);

    @GetMapping("/user")
    List<User> listUsers(@RequestParam("name") String name);
}

// 2. 注入使用
@Service
public class OrderService {

    @Autowired
    private UserClient userClient;

    public void createOrder(Long userId) {
        // 直接调用，自动解包
        User user = userClient.getUser(userId);
        // 失败自动抛异常
    }
}
```

### 完整配置示例

```yaml
# 开发环境配置
extend:
  feign:
    plugin:
      enabled: true
      level: FULL  # 开发环境用 FULL
      mock:
        enabled: true  # 开发环境开启 Mock
        server-map:
          user-service:
            server-url: 127.0.0.1:8081

---
# 生产环境配置
extend:
  feign:
    plugin:
      enabled: true
      level: BASIC  # 生产环境用 BASIC
      mock:
        enabled: false
```

---

## 常见问题 (Q&A)

### Q1: 为什么调用失败了没有返回 Result？

**A**: 框架会自动解包 `Result`，失败直接抛异常。

```java
// 服务 B 返回
Result<User>  → {"code": -1, "message": "用户不存在"}

// 服务 A 调用
User user = userClient.getUser(1L);
// 抛出: CheckedException: 用户不存在

// 如果想要 Result，返回类型声明为 Result
@FeignClient(name = "user-service")
public interface UserClient {
    @GetMapping("/user/{id}")
    Result<User> getUser(@PathVariable Long id);  // 不会解包
}
```

---

### Q2: Header 透传失败怎么办？

**A**: 检查以下几点：

```java
// 1. 确认上游请求带了 Header
// 在 Controller 中打印
@GetMapping("/test")
public void test(HttpServletRequest request) {
    log.info("Headers: {}", Collections.list(request.getHeaderNames()));
}

// 2. 检查 FeignPluginInterceptor 是否生效
@FeignClient(name = "test-service", configuration = CustomConfig.class)
// 如果自定义 configuration，确保不会覆盖默认拦截器

// 3. 检查异步场景
@Async
public void asyncMethod() {
    // RequestContextHolder 在子线程中可能丢失
    // 需要手动传递上下文
}
```

---

### Q3: Mock 模式不生效？

**A**:
```yaml
# 1. 检查配置
extend:
  feign:
    plugin:
      mock:
        enabled: true  # 必须为 true
        server-map:
          user-service:  # 服务名必须匹配
            server-url: localhost:8081

# 2. 检查 @FeignClient name 属性
@FeignClient(name = "user-service")  // 必须和配置一致

# 3. 查看 Mock 服务器是否启动
curl http://localhost:8081/user/1
```

---

### Q4: 如何设置超时时间？

**A**: 使用标准的 Feign 配置

```yaml
spring:
  cloud:
    openfeign:
      client:
        config:
          default:
            connectTimeout: 5000   # 连接超时
            readTimeout: 10000     # 读取超时
          user-service:            # 单个服务配置
            connectTimeout: 3000
            readTimeout: 5000
```

---

### Q5: 日志太多怎么关闭？

**A**:
```yaml
extend:
  feign:
    plugin:
      level: NONE  # 或 BASIC

# 或者在 logback 中调整
logging:
  level:
    feign: ERROR
    com.wemirr.framework.feign: ERROR
```

---

### Q6: 自动解包的本质是什么？

**A**: 自动解包 = JSON 解析 + 取 data 字段

```java
// 服务 B 返回的 JSON 字符串
{
  "code": 200,
  "message": "成功",
  "data": {
    "id": 1,
    "name": "张三"
  }
}

// 框架做的是：
// 1. 用 Result<User> 类型解析 JSON
// 2. 判断 code === 200
// 3. 返回 data 字段（User 对象）
// 4. 如果 code != 200 就抛 CheckedException

// 本质：response.body → Result<User> → result.data → User
```

---

### Q7: Header 透传是什么？有什么用？

**A**: **透传** = **透**明**传**递 = 把收到的 Header 原样转发给下游服务

**本质**：
```java
// 框架做的事（简化版）
@Override
public void apply(RequestTemplate template) {
    // 1. 从当前请求获取 Header
    String token = request.getHeader("Authorization");
    String tenantId = request.getHeader("x-tenant-id");

    // 2. 设置到 Feign 请求中
    template.header("Authorization", token);
    template.header("x-tenant-id", tenantId);
}

// 就是：request.getHeader() → template.header()
```

**使用场景**：

| 场景 | 说明 |
|------|------|
| **认证传递** | 用户登录后的 Token 需要传给所有下游服务验证身份 |
| **租户隔离** | 多租户系统的租户 ID 需要在调用链中传递 |
| **链路追踪** | TraceId 需要贯穿整个调用链，用于日志关联和问题排查 |

**示例**：
```
用户请求（带 Token）
    → 网关（识别用户）
    → 服务 A（调用服务 B 时自动带上 Token）
    → 服务 B（收到 Token，验证用户权限）
```

---

## 学习建议

1. **理解自动解包**: 这是框架最核心的增强
2. **掌握 Header 透传**: 理解哪些信息需要传递
3. **使用 Mock 开发**: 提高前端开发效率
4. **合理设置日志**: 开发 FULL，生产 BASIC

---

## 下一步学习

- [数据变更日志](../wemirr-platform-framework/diff-log-spring-boot-starter) - 操作审计
- [WebSocket](../wemirr-platform-framework/websocket-spring-boot-starter) - 实时消息
- [Excel 处理](../wemirr-platform-framework/easyexcel-spring-boot-starter) - 导入导出
