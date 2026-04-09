# common-framework-core 核心模块详解

> 模块路径: `wemirr-platform-framework/common-framework-core`
> 包路径: `com.wemirr.framework.commons`

## 概述

`common-framework-core` 是整个框架的基础核心模块，提供了：
- 统一响应封装 `Result`
- 实体基类 `Entity` / `SuperEntity`
- 异常处理 `CheckedException`
- 安全上下文 `AuthenticationContext`
- 线程上下文 `ThreadLocalHolder`
- 各种工具类

---

## 目录结构

```
commons/
├── annotation/           # 注解
│   ├── IgnoreGlobalResponse.java
│   ├── log/AccessLog.java
│   └── remote/
├── concurrent/           # 并发工具
│   ├── AsyncExecutor.java
│   └── ParallelResult.java
├── entity/               # 实体类
│   ├── Result.java       # 统一响应
│   ├── Entity.java       # 基础实体
│   ├── SuperEntity.java  # 增强实体
│   ├── Dict.java         # 字典接口
│   └── validator/        # 验证组
├── exception/            # 异常
│   ├── CheckedException.java
│   └── ValidException.java
├── security/             # 安全
│   ├── AuthenticationContext.java    # 认证上下文接口
│   ├── AuthenticationDetails.java   # 认证详情
│   ├── DataPermission.java           # 数据权限
│   └── DataScopeType.java            # 数据权限类型
├── threadlocal/          # 线程本地存储
│   └── ThreadLocalHolder.java        # 上下文持有器
├── utils/                # 工具类
│   ├── TreeBuildUtils.java
│   ├── StreamUtils.java
│   └── reflect/ReflectUtils.java
├── validation/           # 自定义验证
├── i18n/                 # 国际化
├── remote/               # 远程调用
└── times/                # 时间处理
```

---

## 核心类详解

### 1. Result - 统一响应封装

**文件**: [Result.java](../wemirr-platform-framework/common-framework-core/src/main/java/com/wemirr/framework/commons/entity/Result.java)

**响应码定义**:

| 常量 | 值 | 说明 |
|------|-----|------|
| `SUCCESS_CODE` | 200 | 成功 |
| `FAIL_CODE` | -1 | 通用失败 |
| `TIMEOUT_CODE` | -2 | 超时 |
| `VALID_EX_CODE` | -9 | 参数验证异常 |
| `OPERATION_EX_CODE` | -400 | 业务操作异常 |

**使用示例**:

```java
// 成功响应
return Result.success(data);
return Result.ok(data);
return Result.success("操作成功", data);

// 失败响应
return Result.fail("操作失败");
return Result.fail(400, "参数错误");

// 验证失败
return Result.validFail("用户名不能为空");
return Result.validFail("订单 {0} 不存在", "AP1001");

// Builder模式
Result<User> result = Result.<User>builder()
    .code(200)
    .message("成功")
    .data(user)
    .build();
```

**响应结构**:
```json
{
  "code": 200,
  "message": "操作成功",
  "successful": true,
  "timestamp": 1712649600000,
  "data": { ... }
}
```

---

### 2. Entity / SuperEntity - 实体基类

**文件**:
- [Entity.java](../wemirr-platform-framework/common-framework-core/src/main/java/com/wemirr/framework/commons/entity/Entity.java)
- [SuperEntity.java](../wemirr-platform-framework/common-framework-core/src/main/java/com/wemirr/framework/commons/entity/SuperEntity.java)

**继承关系**:
```
Entity<T> (基础实体)
    ↓
SuperEntity<T> (增强实体)
```

#### Entity - 基础实体

| 字段 | 类型 | 说明 | 自动填充 |
|------|------|------|----------|
| `id` | T | 主键ID（雪花算法） | 是 |
| `createBy` | T | 创建人ID | INSERT |
| `createName` | String | 创建人名称 | INSERT |
| `createTime` | Instant | 创建时间 | INSERT |

#### SuperEntity - 增强实体

继承 Entity，额外增加：

| 字段 | 类型 | 说明 | 自动填充 |
|------|------|------|----------|
| `lastModifyBy` | T | 最后修改人ID | INSERT_UPDATE |
| `lastModifyName` | String | 最后修改人名称 | INSERT_UPDATE |
| `lastModifyTime` | Instant | 最后修改时间 | INSERT_UPDATE |
| `deleted` | Boolean | 逻辑删除标识 | INSERT |

**使用示例**:

```java
// 简单实体（只需要创建信息）
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_user")
public class User extends Entity<Long> {
    private String username;
    private String password;
}

// 完整实体（需要修改信息和逻辑删除）
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_order")
public class Order extends SuperEntity<Long> {
    private String orderNo;
    private BigDecimal amount;
}

// 验证组使用
public interface Save extends Default { }
public interface Update extends Default { }

@Data
public class UserDTO extends Entity<Long> {
    @NotNull(message = "用户名不能为空", groups = Save.class)
    private String username;

    @NotNull(message = "ID不能为空", groups = Update.class)
    private Long id;
}
```

---

### 3. CheckedException - 业务异常

**文件**: [CheckedException.java](../wemirr-platform-framework/common-framework-core/src/main/java/com/wemirr/framework/commons/entity/exception/CheckedException.java)

**异常类型**:

| 方法 | HTTP码 | 说明 |
|------|--------|------|
| `badRequest(msg)` | 400 | 请求参数错误 |
| `notFound(msg)` | 404 | 资源不存在 |
| `forbidden(msg)` | 403 | 无权限/登录过期 |

**使用示例**:

```java
// 基础用法
throw new CheckedException("用户不存在");

// 静态方法
throw CheckedException.badRequest("用户名不能为空");
throw CheckedException.notFound("订单 {0} 不存在", "AP1001");
throw CheckedException.forbidden("登录过期，请重新登录");

// 带状态码
throw CheckedException.badRequest(400, "参数错误");

// 使用Dict枚举
throw CheckedException.badRequest(UserErrorCode.USER_NOT_FOUND);

// 带异常链
throw new CheckedException("操作失败", throwable);
```

---

### 4. ThreadLocalHolder - 线程上下文持有器

**文件**: [ThreadLocalHolder.java](../wemirr-platform-framework/common-framework-core/src/main/java/com/wemirr/framework/commons/threadlocal/ThreadLocalHolder.java)

**核心特性**:
- 基于 `TransmittableThreadLocal` 实现
- 支持跨线程池传递上下文
- 线程安全的 `ConcurrentHashMap` 存储

**预定义Key**:

| 常量 | Key | 说明 |
|------|-----|------|
| `KEY_TENANT_ID` | `tenantId` | 租户ID |
| `KEY_USER_ID` | `userId` | 用户ID |
| `KEY_TRACE_ID` | `traceId` | 追踪ID |
| `KEY_LOCALE` | `locale` | 语言环境 |
| `KEY_USER_INFO` | `userInfo` | 用户信息 |

**使用示例**:

```java
// 设置上下文
ThreadLocalHolder.setTenantId(1L);
ThreadLocalHolder.setUserId(100L);
ThreadLocalHolder.set("customKey", "customValue");

// 获取上下文
Long tenantId = ThreadLocalHolder.getTenantId();
Long userId = ThreadLocalHolder.getUserId();
String value = ThreadLocalHolder.getString("customKey");

// 懒加载（只计算一次）
Object data = ThreadLocalHolder.get("expensive", () -> computeExpensiveValue());

// 条件缓存（仅当结果非null时缓存）
Object result = ThreadLocalHolder.get("key", () -> mayReturnNull(), Objects::nonNull);

// 快照与恢复
Map<String, Object> snapshot = ThreadLocalHolder.snapshot();
executor.submit(() -> {
    ThreadLocalHolder.restore(snapshot);
    // 子线程可以获取主线程的上下文
});

// 请求结束时清理（在Filter/Interceptor中）
ThreadLocalHolder.clear();

// 临时切换上下文执行
ThreadLocalHolder.runWith(otherContext, () -> {
    // 在指定上下文中执行
});
```

---

### 5. AuthenticationContext - 认证上下文

**文件**: [AuthenticationContext.java](../wemirr-platform-framework/common-framework-core/src/main/java/com/wemirr/framework/commons/security/AuthenticationContext.java)

**接口方法**:

```java
public interface AuthenticationContext {
    // 租户信息
    String tenantCode();           // 租户编码
    Long tenantId();               // 租户ID
    String tenantName();           // 租户名称

    // 用户信息
    Long userId();                 // 用户ID
    String nickname();             // 用户昵称
    String mobile();               // 手机号

    // 认证信息
    String clientId();             // 客户端ID
    UserType userType();           // 用户类型
    boolean anonymous();           // 是否匿名

    // 权限信息
    List<String> funcPermissionList();    // 功能权限
    List<String> rolePermissionList();    // 角色权限
    DataPermission dataPermission();      // 数据权限
}
```

**使用场景**:
在业务代码中通过实现此接口获取当前登录用户信息，通常配合 `ThreadLocalHolder` 使用。

---

## 数据权限设计

**核心类**:
- `DataPermission` - 数据权限范围
- `DataScopeType` - 数据权限类型枚举
- `DataResourceType` - 数据资源类型

**数据权限类型**:
```java
public enum DataScopeType {
    ALL,           // 全部数据
    CUSTOM,        // 自定义数据
    DEPT,          // 本部门数据
    DEPT_AND_SUB,  // 本部门及子部门数据
    SELF           // 仅本人数据
}
```

---

## 工具类

| 类名 | 功能 |
|------|------|
| `JacksonUtils` | JSON序列化/反序列化 |
| `BeanUtilPlus` | Bean拷贝增强 |
| `TreeBuildUtils` | 树形结构构建 |
| `StreamUtils` | Stream流工具 |
| `ReflectUtils` | 反射工具 |
| `DigestUtil` | 摘要/加密工具 |
| `MapHelper` | Map操作工具 |
| `MvelHelper` | MVEL表达式引擎 |
| `AreaUtils` / `RegionUtils` | 地区工具 |

---

## 注解

| 注解 | 位置 | 说明 |
|------|------|------|
| `@IgnoreGlobalResponse` | 方法/类 | 忽略全局响应包装 |
| `@AccessLog` | 方法 | 访问日志记录 |
| `@Remote` | 方法 | 远程调用标记 |
| `@RemoteResult` | 方法 | 远程调用结果 |

---

## 自定义验证注解

| 注解 | 功能 |
|------|------|
| `@Name` | 名称验证（自定义规则） |
| `@DateTime` | 日期时间验证 |

**验证组**:
- `Save` - 新增验证组
- `Update` - 更新验证组
- `LessGroup` - 精简验证组

---

## 学习建议

1. **先掌握核心类**: Result → Entity/SuperEntity → CheckedException
2. **理解上下文机制**: ThreadLocalHolder 是理解整个框架多租户、权限控制的关键
3. **实践**:
   - 创建实体继承 `Entity` 或 `SuperEntity`
   - 使用 `Result` 封装接口返回
   - 使用 `CheckedException` 抛出业务异常
   - 使用 `ThreadLocalHolder` 存储请求上下文

---

## 下一步学习

- [common-spring-boot-starter](../wemirr-platform-framework/common-spring-boot-starter) - 基于 core 的 Spring Boot 自动配置
- [db-spring-boot-starter](../wemirr-platform-framework/db-spring-boot-starter) - 数据库增强
- [security-spring-boot-starter](../wemirr-platform-framework/security-spring-boot-starter) - 安全认证
