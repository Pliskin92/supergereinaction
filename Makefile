PSN00BSDK ?= /opt/psn00bsdk
PREFIX ?= mipsel-none-elf-

CC := $(PREFIX)gcc
LD := $(CC)
OBJCOPY := $(PREFIX)objcopy
MKPSXISO ?= mkpsxiso

TARGET := MAIN.EXE
ISO_NAME := super_gere_parise_rescue
BUILD_DIR := build

SRCS := main.c player.c assists.c levels.c
OBJS := $(SRCS:%.c=$(BUILD_DIR)/%.o)

CFLAGS := -O2 -G0 -Wall -Wextra -msoft-float -fno-builtin -ffreestanding \
	-I$(PSN00BSDK)/include
LDFLAGS := -T$(PSN00BSDK)/lib/ps-exe.ld -L$(PSN00BSDK)/lib
LDLIBS := -lpsxgpu -lpsxgte -lpsxetc -lpsxapi -lpsxpad -lpsxspu -lc -lgcc

.PHONY: all clean iso

all: $(TARGET)

$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

$(BUILD_DIR)/%.o: %.c | $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

$(TARGET): $(OBJS)
	$(LD) $(OBJS) $(LDFLAGS) $(LDLIBS) -o $@

$(BUILD_DIR)/SYSTEM.CNF: | $(BUILD_DIR)
	printf 'BOOT = cdrom:\\%s;1\r\nTCB = 4\r\nEVENT = 10\r\nSTACK = 801FFFF0\r\n' "$(TARGET)" > $@

$(BUILD_DIR)/disc.xml: $(BUILD_DIR)/SYSTEM.CNF $(TARGET)
	printf '<iso_project image_name="%s.bin">\n' "$(ISO_NAME)" > $@
	printf '  <track type="data">\n' >> $@
	printf '    <file src="%s" target="%s" />\n' "$(BUILD_DIR)/SYSTEM.CNF" "SYSTEM.CNF;1" >> $@
	printf '    <file src="%s" target="%s" />\n' "$(TARGET)" "$(TARGET);1" >> $@
	printf '  </track>\n' >> $@
	printf '</iso_project>\n' >> $@

iso: $(BUILD_DIR)/disc.xml
	$(MKPSXISO) $(BUILD_DIR)/disc.xml

clean:
	rm -rf $(BUILD_DIR) $(TARGET) $(ISO_NAME).bin $(ISO_NAME).cue
