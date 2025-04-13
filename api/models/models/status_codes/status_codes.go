package status_codes

const (
	Unknown          = 0
	Success          = 20001
	InvalidParams    = 20002
	Error            = 20004
	ValidationFailed = 20005
)

var MsgFlags = map[int]string{
	Unknown:          "unknown",
	Success:          "success",
	Error:            "error",
	InvalidParams:    "invalidParams",
	ValidationFailed: "validationFailed",
}

// GetMsg get error information based on Code
func GetMsg(code int) string {
	msg, ok := MsgFlags[code]
	if ok {
		return msg
	}

	return MsgFlags[Error]
}
