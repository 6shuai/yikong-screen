<template>
    <div class="login-wrap">
        <div class="form">
            <h2>序列号</h2>
            <input
                class="input"
                v-model="serialNumber"
                placeholder="请输入屏幕序列号"
            />
            <img
                class="login-btn"
                v-if="!loginLoading"
                @click="submitBtn"
                src="../../static/image/login/login.png"
            />
            <img
                class="login-btn loading"
                v-if="loginLoading"
                src="../../static/image/login/loading.png"
            />
            <div class="login-error" v-if="!loginLoading">{{ loginError }}</div>
        </div>
    </div>
</template>
<script>
export default {
    props: ["loginError"],
    data() {
        return {
            loginLoading: false,
            serialNumber: "", //序列号
        };
    },
    methods: {
        //提交
        submitBtn() {
            if (this.serialNumber) {
                this.loginLoading = true;
                this.$emit("loginClick", this.serialNumber.trim());
            }
        },

        //获取本地序列号 登录
        setSerialNumber(number) {
            this.serialNumber = number;
            this.loginLoading = true;
        },
    },
};
</script>
<style scope>
.login-wrap {
    width: 100%;
    height: 100%;
    background: -webkit-radial-gradient(
            0 100%,
            ellipse cover,
            rgba(104, 128, 138, 0.4) 10%,
            rgba(138, 114, 76, 0) 40%
        ),
        linear-gradient(
            180deg,
            rgba(57, 173, 219, 0.25) 0,
            rgba(42, 60, 87, 0.4)
        ),
        linear-gradient(135deg, #670d10, #092756);
    display: flex;
    justify-content: center;
    align-items: center;
}
h2 {
    color: #fff;
    line-height: 60px;
}
.form input {
    width: 300px;
    height: 36px;
    background: #fff;
    border-radius: 0;
    padding: 5px 10px;
    border: 1px solid #fff;
    border-radius: 5px;
    outline: none;
    font-size: 16px;
}

.login-btn {
    width: 38px;
    height: 38px;
    cursor: pointer;
}

.loading {
    animation: turn 0.8s linear infinite;
}

@keyframes turn {
    0% {
        -webkit-transform: rotate(0deg);
    }
    25% {
        -webkit-transform: rotate(90deg);
    }
    50% {
        -webkit-transform: rotate(180deg);
    }
    75% {
        -webkit-transform: rotate(270deg);
    }
    100% {
        -webkit-transform: rotate(360deg);
    }
}

.login-error {
    font-size: 16px;
    color: red;
    padding-top: 10px;
}
</style>